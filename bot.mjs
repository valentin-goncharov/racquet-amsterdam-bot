import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { JSDOM } from 'jsdom';
import { parse, format } from 'date-fns';
import enGB from 'date-fns/locale/en-GB/index.js';
import enUS from 'date-fns/locale/en-US/index.js';
import fr from 'date-fns/locale/fr/index.js';
import de from 'date-fns/locale/de/index.js';
import ru from 'date-fns/locale/ru/index.js';
import nl from 'date-fns/locale/nl/index.js';
import config from './config.json' assert { type: 'json' };
import fetch from 'node-fetch';
import FetchCookie from 'fetch-cookie';



dotenv.config();

const fetchWithCookies = FetchCookie(fetch);

const token = process.env.TELEGRAM_BOT_API_TOKEN;

const dateFormats = [
    'yyyy-MM-dd',
    'dd MMMM yyyy',
    'dd. MMMM yyyy',
    'MMMM dd, yyyy',
    'MMM dd, yyyy',
    'dd/MM/yyyy',
    'dd.MM.yyyy',
    'dd-MM-yyyy',
    'dd MMM',
    'dd MMMM',
    'MMM dd',
    'MMMM dd',
];
const locales = [enUS, enGB, fr, nl, de, ru];

let bot;

if (process.env.NODE_ENV !== 'test') {
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/squash(?:\s+locations)?(?:\s+(.*?)(?:\s+([\s\S]+))?)?$/, async (msg, match) => {
        console.log("squash: Received new command");
        const chatId = msg.chat.id;
        const  message = await handleCommand("squash", msg, match)
        console.log("squash: Message successfully handled");
        bot.sendMessage(chatId, `${escapeMessage(message)}`, {parse_mode: 'MarkdownV2'});
        console.log("squash: Response has send");
    });

    bot.onText(/\/tennis(?:\s+locations)?(?:\s+(.*?)(?:\s+([\s\S]+))?)?$/, async (msg, match) => {
        console.log("tennis: Received new command");
        const chatId = msg.chat.id;
        const  message = await handleCommand("tennis", msg, match)
        console.log("tennis: Message successfully handled");
        bot.sendMessage(chatId, `${escapeMessage(message)}`, {parse_mode: 'MarkdownV2'});
        console.log("tennis: Response has send");
    });

    bot.on('/help', (msg) => {
        const chatId = msg.chat.id;
        const helpMessage = `Acceptable commands:
    \\squash locations
    \\squash {location} {optional date}
    \\tennis locations
    \\tennis {location} {optional date}
    `
        bot.sendMessage(chatId, helpMessage);
    });
}

async function handleCommand(command, msg, match) {
    const locations = config.locations[command];

    let message;
    console.log(`${command}: received command ${match[0]}`)
    if (match[0] === `/${command} locations`) {
        message = `Available ${command} locations: \n${locations.map(locationId => {
            return `${config[locationId.toLowerCase()].id} : ${locationString(locationId.toLowerCase())}`
        }).join('\n')}`;
    } else if (match[1]) {
        const place = match[1];
        const locationId = place.toLowerCase()

        const locationExists = locations.some((location) => location.toLowerCase() === locationId);

        if (locationExists) {

            const date = parseDate(match[2]? match[2] : '')

            const [isValidDate,  errorMessage] = checkDate(date)
            if (!isValidDate) {
                message = `${config[locationId].name}: ${locationString(locationId)}\n${errorMessage}`;
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let freeSlots = await fetchAndParseTable(command, locationId, date);
                if (date.getTime() ===  today.getTime()) {
                    const now = new Date();
                    freeSlots.forEach((slot) => {
                        slot.timeSlots = slot.timeSlots.filter((ts) => {
                           const [hours, minutes] = ts.split(":");
                           if (parseInt(hours) < now.getHours()) {
                               return false;
                           } else if (parseInt(hours) === now.getHours() && parseInt(minutes) < now.getMinutes()) {
                               return false;
                           }
                           return true;
                        });
                    });
                    freeSlots = freeSlots.filter((lane) => lane.timeSlots.length > 0)
                }

                const formattedDate = format(date, "dd MMMM yyyy", {locale: enGB})
                if (freeSlots.length > 0) {
                    message = `${config[locationId].name}: ${locationString(locationId)}\n`;
                    message = message + freeSlots.map((slot, index) => {
                        const markdown = index % 2 === 0 ? '*' : '_'
                        return `${markdown}${slot.name}: ${slot.timeSlots.join(', ')}${markdown}`
                    }).join('\n');
                } else {
                    message = `${config[locationId].name}: ${locationString(locationId)}\nI'm sorry but there are no free slots left on ${formattedDate}`;
                }

            }
        } else {
            message = `I'm sorry, but the provided location "${place}" is unknown to me.\nPlease use one of the known locations: \n${locations.map(locationId => {
                return `${config[locationId.toLowerCase()].id} : ${locationString(locationId.toLowerCase())}`
            }).join('\n')}`;
        }
    } else {
        message = `Please use the command in the format "/${command} \\{place\\} \\{date\\}" or "/${command} locations"`;
    }

    return message;
}

function escapeMessage(message) {
    return message.replace(/\./g, '\\.');
}

function locationString(locationId) {
    const location = config[locationId]
    return `${location.address} [${location.website}](${location.website})`
}

function parseDate(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const startCurrentYear = new Date(currentYear, 0, 1)
    const startNextYear = new Date(currentYear + 1, 0, 1)

    let date = today;

    switch (dateString) {
        case '':
        case 'today':
            break;
        case 'tomorrow':
            date.setDate(date.getDate() + 1)
            break;
        default: {
            for (const format of dateFormats) {
                for (const locale of locales) {
                    let parsedDate = parse(dateString, format, startCurrentYear, { locale });
                    if (!isNaN(parsedDate)) {
                        if (parsedDate.getTime() < today.getTime()) {
                            parsedDate = parse(dateString, format, startNextYear, {locale});
                        }
                        date =  parsedDate;
                    }
                }
            }
            break;
        }
    }

    return date;
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

async function authenticate(locationId) {
    try {
        const formData = new FormData();
        const username = process.env.SQUASH_BOT_LOGIN
        const password = process.env.SQUASH_BOT_PASSWORD
        const loginUrl = config[locationId].baseUrl+"/auth/login"
        formData.append('username', username);
        formData.append('password', password);

        console.log(`try to authorise at ${locationId} `)
        await fetchWithCookies(loginUrl, {
            method: 'POST',
            body: formData
        });
        console.log(`authorised at ${locationId} `)
    } catch (error) {
        console.error('Error authentication:', error);
        throw error;
    }
}

async function fetchAndParseTable(sport, locationId, date) {
    try {
        const formattedDate = format(date, "yyyy-MM-dd")
        const sports = config[locationId][sport]
        let result = []
        for (let sport of sports) {
            const url = config[locationId].baseUrl+`/reservations/${formattedDate}/sport/${sport}`
            console.log(`try 1 to fetch table from url ${url} `)
            let table = await fetchTable(url)
            if(!table) {
                await authenticate(locationId)
                console.log(`${sport}: try 2 to fetch table from url ${url} `)
                table = await fetchTable(url)
            }
            if (table) {
                result = result.concat(parseTable(table))
            }
        }
        return result;
    } catch (error) {
        console.error('Error fetching and parsing table:', error);
        throw error;
    }
}

async function fetchTable(url) {
    try {
        console.log(`call url ${url} `)
        const response = await fetchWithCookies(url);
        console.log(`received response from url ${url} `)
        const text = await response.text();
        const dom = new JSDOM(text);
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

async function webhookHandler(event, context) {

    try {
        const body = JSON.parse(event.body);
        await bot.processUpdate(body);
        return {
            statusCode: 200,
            body: 'OK',
        };
    } catch (error) {
        console.error('Error processing update:', error);
        return {
            statusCode: 500,
            body: 'Error processing update',
        };
    }
}

export { parseDate, parseTable, webhookHandler};