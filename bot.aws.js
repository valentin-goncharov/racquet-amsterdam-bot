const serverlessHttp = require('serverless-http');
const { bot } = require('./bot');

// Make sure to initialize the bot
bot.launch();

module.exports.handler = serverlessHttp(bot.webhookCallback('aws'));
