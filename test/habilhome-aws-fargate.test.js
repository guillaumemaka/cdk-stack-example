const { expect, matchTemplate, MatchStyle } = require('@aws-cdk/assert');
const cdk = require('@aws-cdk/core');
const HabilhomeAwsFargate = require('../lib/habilhome-aws-fargate-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new HabilhomeAwsFargate.HabilhomeAwsFargateStack(app, 'MyTestStack');
    // THEN
    expect(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
