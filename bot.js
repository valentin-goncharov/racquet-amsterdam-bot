const axios = require('axios');
const { Telegraf } = require('telegraf');
const { format } = require("date-fns");
const { enGB } = require("date-fns/locale");
const { JSDOM } = require('jsdom');
const commandArgs = require('./command-args');
const config = require('./config.json');

const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN
if (TELEGRAM_BOT_API_TOKEN === undefined) {
    throw new Error('TELEGRAM_BOT_API_TOKEN must be provided!');
}

const instances = new Map();

//

const helpMessage = `Hi I'm Racquet Amsterdam Bot!
I can help you to find a free court.
I understand commands:
 - /squash locations
 - /squash {location} {optional date} {optional time}
 - /tennis locations
 - /tennis {location} {optional date} {optional time}`;

//-BOT------------
const bot = new Telegraf(TELEGRAM_BOT_API_TOKEN);
bot.use(commandArgs());

bot.start((ctx) => {
    ctx.reply(helpMessage);
})

bot.help((ctx) => {
    ctx.reply(helpMessage);
});

bot.command('squash', async (ctx) => {
    console.log(`received command ${ctx}`);
    const message = await handleCommand(ctx.state.command);
    ctx.replyWithMarkdownV2(escapeMessage(message));
    console.log(['ctx.reply', ctx]);
});

bot.command('tennis', async (ctx) => {
    console.log(`received command ${ctx}`);
    const message = await handleCommand(ctx.state.command);
    ctx.replyWithMarkdownV2(escapeMessage(message));
    console.log(['ctx.reply', ctx]);
});

// Functions

async function handleCommand(command) {
    const locations = config.locations[command.command];

    let message;
    console.log(`received command ${command.text}`);
    if (command.argsString === `locations`) {
        message = `Available ${command.command} locations:\n${locations.map(location => {
            const locationId = location.toLowerCase();
            return `${config[locationId].id} : ${locationString(locationId)}`
        }).join('\n')}`;
    } else {
        const args = command.args;
        if (args && args.location) {
            const place = args.location
            const locationId = place.toLowerCase()

            const locationExists = locations.some((location) => location.toLowerCase() === locationId);

            if (locationExists) {

                const date = args.date;
                const time = args.time;

                const [isValidDate,  errorMessage] = checkDate(date)
                if (!isValidDate) {
                    message = `${config[locationId].name}: ${locationString(locationId)}\n${errorMessage}`;
                } else {
                    let freeSlots = await fetchAndParseTable(command.command, locationId, date);

                    const [begin, end] = getDateTimeBoundaries(date, time);

                    freeSlots.forEach((slot) => {
                        slot.timeSlots = slot.timeSlots.filter((ts) => {
                            const [hoursString, minutesString] = ts.split(":");
                            const hours = parseInt(hoursString);
                            const minutes = parseInt(minutesString);
                            if (hours < begin.getHours() || hours > end.getHours()) {
                                return false;
                            } else if (hours === begin.getHours() && minutes < begin.getMinutes()) {
                                return false;
                            } else if (hours === end.getHours() && minutes > end.getMinutes()) {
                                return false;
                            }
                            return true;
                        });
                    });
                    freeSlots = freeSlots.filter((lane) => lane.timeSlots.length > 0)

                    const formattedDate = format(date, "dd MMMM yyyy", {locale: enGB});
                    const formattedTime =  formatTime(args.timeCommand, begin, end);
                    if (freeSlots.length > 0) {
                        let reducedCourtString = false;
                        message = `${config[locationId].name}: ${locationString(locationId)}\nAvailable slots on ${formattedDate} ${formattedTime}\n`;
                        message = message + freeSlots.map((slot, index) => {
                            const markdown = index % 2 !== 0 ? '*' : '_';
                            let slotsString;
                            if (slot.timeSlots.length < 31) {
                                slotsString = slot.timeSlots.join(', ');
                            } else {
                                reducedCourtString = true;
                                slotsString = `${slot.timeSlots.slice(0, 8).join(', ')} ... ${slot.timeSlots.pop()}`;
                            }
                            return `${markdown}${slot.name}: ${slotsString}${markdown}`;
                        }).join('\n');
                        if (reducedCourtString) {
                            message = `${message}\n\n\`Notice\\! Some time slots are not displayed due to too many time slots, please specify the time if you want to see the available time slots.\``;
                        }
                    } else {
                        message = `${config[locationId].name}: ${locationString(locationId)}\nI'm sorry but there are no free slots left on ${formattedDate} ${formattedTime}`;
                    }

                }
            } else {
                message = `I'm sorry, but the provided location "${place}" is unknown to me.\nPlease use one of the known locations: \n${locations.map(locationId => {
                    return `${config[locationId.toLowerCase()].id} : ${locationString(locationId.toLowerCase())}`
                }).join('\n')}`;
            }
        } else {
            message = emptyMessageString(command.command);
        }
    }

    return message;
}

function locationString(locationId) {
    const location = config[locationId]
    return `${location.address} [${location.website}](${location.website})`
}

function emptyMessageString(command) {
    return `Please use the command in the one of available formats: 
 \\- /${command} locations
 \\- /${command} \\{location\\} \\{date\\}
 \\- /${command} \\{location\\} \\{date\\} before \\{time\\}
 \\- /${command} \\{location\\} \\{date\\} after \\{time\\}
 \\- /${command} \\{location\\} \\{date\\} between \\{start time\\} and \\{end time\\}
 \\- /${command} \\{location\\} \\{date\\} from \\{start time\\} to \\{end time\\}`;
}

function escapeMessage(message) {
    return message.replace(/\./g, '\\.');
}

function checkDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let message = '';
    let valid = true;
    if (date < today) {
        valid = false;
        message = `I'm sorry, but you can't see schedule for the past`
    }

    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 7) {
        valid = false;
        message = `I'm sorry, but the schedule is available only for 7 days.`
    }
    return [valid, message]
}

function getDateTimeBoundaries(date, time) {
    const now = new Date();
    const today = new Date();
    today.setHours(0,0,0,0);

    let begin = new Date();
    begin.setTime(date.getTime());

    let end = new Date();
    end.setTime(date.getTime());

    if (!time) {
        if (date.getTime() === today.getTime()) {
            begin = new Date();
            end.setHours(23, 59, 0, 0);
        } else {
            end.setHours(23, 59, 0, 0);
        }
    } else {
        if (date.getTime() === today.getTime() && (now.getHours() > time.begin.hours || (now.getHours() === time.begin.hours && now.getMinutes() > time.begin.minutes))) {
            begin = now;
        } else {
            begin.setHours(time.begin.hours, time.begin.minutes, 0, 0);
        }
        end.setHours(time.end.hours, time.end.minutes, 0, 0);
    }

    return [begin, end];
}

function formatTime(timeCommand, begin, end) {
    const today = new Date();
    const isToday = (today.getDate() === begin.getDate() && today.getMonth() === begin.getMonth() && today.getFullYear() === begin.getFullYear());
    const command = timeCommand ? timeCommand : (isToday ? "after" : "")
    switch (command) {
        case "after":
            return `after ${format(begin, "HH:mm")}`;
        case "before":
            return `before ${format(end, "HH:mm")}`;
        case "":
            return "";
        default:
            return `between ${format(begin, "HH:mm")} and ${format(end, "HH:mm")}`;
    }
}

async function fetchAndParseTable(sport, locationId, date) {
    try {
        const formattedDate = format(date, "yyyy-MM-dd")
        const sports = config[locationId][sport]
        let result = []
        for (let sport of sports) {
            const url = `/reservations/${formattedDate}/sport/${sport}`;

            const instance = instances[locationId] ? instances[locationId] : axios.create({
                withCredentials: true,
                baseURL: config[locationId].baseUrl,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
            });
            instances[locationId] = instance;
            console.log(`try 1 to fetch table from url ${config[locationId].baseUrl + url} `)
            let table = await fetchTable(instance, url);
            if(!table) {
                await authenticate(instance, locationId);
                console.log(`${sport}: try 2 to fetch table from url ${config[locationId].baseUrl + url} `)
                table = await fetchTable(instance, url)
            }
            if (table) {
                result = result.concat(parseTable(table));
            }
        }
        return result;
    } catch (error) {
        console.error('Error fetching and parsing table:', error);
        throw error;
    }
}

async function authenticate(client, locationId) {
    try {
        const formData = new FormData();
        const username = process.env.SQUASH_BOT_LOGIN
        const password = process.env.SQUASH_BOT_PASSWORD
        const loginUrl = "/auth/login"
        formData.append('username', username);
        formData.append('password', password);

        console.log(`try to authorise at ${locationId} `)
        const response = await client.post(loginUrl, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            maxRedirects: 0,
            withCredentials: true,
        });
        console.log(`response: ${response} `);
        console.log(`data: ${response} `);
        response.headers['set-cookie'].filter(cookie => {
            console.log(cookie);
            return true;
        });
        client.defaults.headers.get['Cookie'] = response.headers['set-cookie'];
        console.log(`authorised at ${locationId} `)
    } catch (error) {
        console.error('Error authentication:', error);
        throw error;
    }
}

async function fetchTable(client, url) {
    try {
        console.log(`call url ${client.baseURL + url} `)
        const response = await client.get(url, {
            maxRedirects: 0,
            withCredentials: true,
        });
        console.log(`received response from url ${client.baseURL} `)
        const dom = new JSDOM(response.data);
        return  dom.window.document.querySelector('table.matrix');
    } catch (error) {
        console.error('Error fetching table:', error);
        throw error;
    }
}

function parseTable(table) {
    const parsedTable = new Map()

    const headers = table.querySelectorAll('th.header-name:not(.empty)');

    headers.forEach((header) => {
        const laneNumber = header.className.match(/r-(\d+)/)[1];
        const laneName = header.textContent.trim();
        parsedTable.set(laneNumber, {
            name: laneName,
            timeSlots: []
        })
    });

    const rows = table.querySelectorAll('.matrix tr');

    rows.forEach((row) => {
        const timeSlot = row.getAttribute('data-time');
        const lanes = row.querySelectorAll('td[type="free"], td[type="taken"], td[type="blocked"]');

        lanes.forEach((lane) => {
            const status = lane.getAttribute('type');
            const laneNumber = lane.className.match(/r-(\d+)/)[1];

            if (status === 'free') {
                parsedTable.get(laneNumber).timeSlots.push(timeSlot);
            }
        });
    });

    return Array.from(parsedTable.values()).filter((lane) => lane.timeSlots.length > 0);
}

module.exports = {
    bot
}
