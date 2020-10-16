import * as cdk from '@aws-cdk/core'
import * as ecs from '@aws-cdk/aws-ecs'
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as  s3 from '@aws-cdk/aws-s3'
import * as  ses from '@aws-cdk/aws-ses'
import * as  route53 from '@aws-cdk/aws-route53'


interface ClusterAwareStackProps extends cdk.StackProps {
  readonly cluster: ecs.Cluster
}

interface ApiAwareStackProps extends cdk.StackProps {
  readonly apiService: ecs_patterns.ApplicationLoadBalancedFargateService
}

interface HabilhomeStackProps {
  readonly cluster: ecs.Cluster;
  readonly vpc?: ec2.Vpc | undefined;
  readonly bucket?: s3.Bucket | undefined;;
  readonly hostedZoneId?: route53.HostedZone | undefined
}

class HabilhomeBaseStack extends cdk.Stack implements HabilhomeStackProps {
  cluster: ecs.Cluster;
  vpc: ec2.Vpc;
  bucket: s3.Bucket;
  hostedZoneId: route53.HostedZone
  
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope?: cdk.Construct, id?: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'habilhome-vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ECS cluster
    this.cluster = new ecs.Cluster(this, 'habilhome-cluster', {
      vpc: this.vpc,
    });

    this.hostedZoneId = route53.HostedZone.fromHostedZoneId(this, 'habilhome-hosted-zone', 'habilhome.com') as route53.HostedZone

    // S3
    this.bucket = new s3.Bucket(this, 'habilhome', {
      publicReadAccess: true,
    });

    

    // this.taskDefinition = new ecs.FargateTaskDefinition(
    //   this,
    //   'habilhome-definition',
    //   {
    //     cpu: 2048,
    //     memoryLimitMiB: 4096
    //   },
    // );

    // The code that defines your stack goes here
  }
}

interface ApiStackProps extends cdk.StackProps {
  readonly bucket?: s3.Bucket
  readonly natsService?: ecs.FargateService
  readonly hostedZoneId?: route53.HostedZone | undefined
}

class Api extends cdk.Stack {
  readonly service: ecs_patterns.ApplicationLoadBalancedFargateService

  constructor(scope?: cdk.Construct, id?: string, props?: ClusterAwareStackProps & ApiStackProps) {
    super(scope, id, props);
    
    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'habilhome-api-definition', {})

    const apiContainer = apiTaskDefinition.addContainer('habilhome-api', {
      image: ecs.ContainerImage.fromAsset('../api', {}),
      cpu: 2048,
      memoryLimitMiB: 512,
      environment: {
        NATS_HOST: props?.natsService.serviceName!,
        AWS_S3_BUCKET: props?.bucket.bucketName!
      }
    })

    apiContainer.addPortMappings({
      containerPort: 80,
    })

    this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'habilhome-api-service', {
      cluster: props?.cluster,
      domainName: 'dev-api.habilhome.com',
      domainZone: props?.hostedZoneId,
      taskDefinition: apiTaskDefinition
    })

    props?.bucket!.grantReadWrite(apiContainer.taskDefinition.taskRole)
  }
}

class Frontend extends cdk.Stack {
  constructor(scope?: cdk.Construct, id?: string, props?: ClusterAwareStackProps & ApiStackProps & ApiAwareStackProps) {
    super(scope, id, props);
    
    const frontendTaskDefinition = new ecs.FargateTaskDefinition(this, 'habilhome-api-definition', {})

    const frontendContainer = frontendTaskDefinition.addContainer('habilhome-frontend', {
      image: ecs.ContainerImage.fromAsset('../frontend', {}),
      cpu: 512,
      memoryLimitMiB: 512
    })

    frontendContainer.addPortMappings({
      containerPort: 80,
    })

    const frontendService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'habilhome-frontend', {
      domainName: 'dev-api.habilhome.com',,
      domainZone: props?.hostedZoneId,
      cluster: props?.cluster,
      taskDefinition: frontendTaskDefinition
    })
  }
}

class Admin extends cdk.Stack {
  constructor(scope?: cdk.Construct, id?: string, props?: ApiStackProps & ApiAwareStackProps & ClusterAwareStackProps) {
    super(scope, id, props);
    
    const adminTaskDefinition = new ecs.FargateTaskDefinition(this, 'habilhome-api-definition', {})

    const adminContainer = adminTaskDefinition.addContainer('habilhome-admin', {
      image: ecs.ContainerImage.fromAsset('../admin', {}),
      cpu: 512,
      memoryLimitMiB: 512,
      environment: {
        CONTAINER_API_URL: props?.apiService.service.serviceName!
      }
      
    })

    adminContainer.addPortMappings({
      containerPort: 80,
    })

    const frontendService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'habilhome-frontend', {
      cluster: props?.cluster,
      domainName: 'frontend.habilhome.com',
      domainZone: props?.hostedZoneId,
      taskDefinition: adminTaskDefinition
    })
  }
}

class Worker extends cdk.Stack {
  constructor(scope?: cdk.Construct, id?: string, props?: ApiStackProps & ApiAwareStackProps & ClusterAwareStackProps) {
    super(scope, id, props);

    // Worker
    const workerDefinition = new ecs.FargateTaskDefinition(this, 'habilhome-worker-definition', {
      cpu: 1024,
      memoryLimitMiB: 512,
       
    });

    const container = this.workerDefinition.addContainer('worker', {
      image: ecs.ContainerImage.fromAsset('./worker'),
      cpu: 1024,
      memoryLimitMiB: 512,
      environment: {
        MONGO_URI: ''
      },
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'worker'
      })
    });

    const worker = new ecs.FargateService(this, 'worker', {
      cluster: props?.cluster!,
      taskDefinition: workerDefinition,
    });

  }
}

interface NatsServerProps {
  readonly cluster: ecs.Cluster
}

class NatsServer extends cdk.Stack {
  readonly natsService: ecs.FargateService

  constructor(scope?: cdk.Construct, id?: string, props?: cdk.StackProps & NatsServerProps ) {
    super(scope, id, props);
    
    const natsTask = new ecs.FargateTaskDefinition(this, 'nats-server-definition', {
      cpu: 512,
      memoryLimitMiB: 512
    })

    const natsContainer = natsTask.addContainer('nats', {
      image: ecs.ContainerImage.fromRegistry('nats:2.1.8-alpine')
    })

    natsContainer.addPortMappings({
      containerPort: 4222
    })

    this.natsService = new ecs.FargateService(this, 'nats-server-service', {
      cluster: props?.cluster!,
      taskDefinition: natsTask
    })


  }
}

class HabilhomeApp extends cdk.App {
  constructor(props?: cdk.AppProps) {
    super(props)

    const base = new HabilhomeBaseStack(this, 'habilhome-app', {})
    
    const nats = new NatsServer(this, 'nats', {
      cluster: base.cluster
    })  

    const api = new Api(this, 'api', {
      cluster: base.cluster,
      natsService: nats.natsService,
      hostedZoneId: base.hostedZoneId
    })
    
    new Frontend(this, 'frontend', {
      cluster: base.cluster,
      apiService: api.service
    })

    new Admin(this, 'admin', {
      cluster: base.cluster,
      apiService: api.service
    })

    new Worker(this, 'worker', {
      cluster: base.cluster
    })
  }
}

export { HabilhomeBaseStack, HabilhomeApp };
