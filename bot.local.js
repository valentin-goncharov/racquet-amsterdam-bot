const dotenv = require('dotenv');
dotenv.config();

const { bot } = require('./bot.js');
bot.launch();
