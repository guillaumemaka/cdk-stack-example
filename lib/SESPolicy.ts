export default {
    Effect: 'Allow',
    Action: [
      'ses:SendEmail',
      'ses:SendRawEmail'
    ],
    Resource: '*'
}

