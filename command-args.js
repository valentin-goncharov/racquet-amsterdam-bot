const {parse} = require("date-fns");
const {enUS, enGB, fr, nl, de, ru} = require("date-fns/locale");

const regex = /^\/([^@\s]+)@?(?:(\S+)|)\s?([\s\S]+)?$/i;
const commandRegex = /^([a-z]+)(\s+([a-z0-9-/.\s]+))?((\s+(before|after|between|from))+?\s([0-9]{1,2}:[0-9]{1,2})(\s+(and|to)\s+([0-9]{1,2}:[0-9]{1,2}))?)?$/i;

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

function parseArgs(command) {
    if (!command || command === 'locations') {
        return {};
    }
    const args = commandRegex.exec(command);
    if (!args) {
        return {};
    }

    let time = null;

    const timeCommand = args[6];

    if (args[7] || args[10]) {
        switch (timeCommand) {
            case 'before':
                time = {
                    begin: parseTime("00:00"),
                    end: parseTime(args[7]),
                };
                break;
            case 'after':
                time = {
                    begin: parseTime(args[7]),
                    end: parseTime("23:59"),
                };
                break;
            default:
                time = {
                    begin: parseTime(args[7] ? args[7] : "00:00"),
                    end: parseTime(args[10] ?  args[10] : "23:59"),
                };
                break;
        }
    }

    return {
        location: args[1],
        date: parseDate(args[3]),
        time: time,
        timeCommand: timeCommand,
    }
}

function parseDate(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const startCurrentYear = new Date(currentYear, 0, 1)
    const startNextYear = new Date(currentYear + 1, 0, 1)

    let date = today;

    switch (dateString) {
        case undefined:
        case null:
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

function parseTime(time) {
    const timeParts = time.split(':');
    let hours;
    let minutes = 0;
    if (timeParts.length === 2) {
        hours = parseInt(timeParts[0]);
        minutes = parseInt(timeParts[1]);
    } else {
        hours = parseInt(timeParts[0]);
    }

    return {
        hours: hours,
        minutes: minutes
    }
}

module.exports = () => (ctx, next) => {
    if (ctx.updateType === 'message' || ctx.updateType === 'channel_post') {
        const message = ctx.updateType === 'channel_post' ? ctx.channelPost : ctx.message;
        if (message.text) {
            const parts = regex.exec(message.text);
            if (!parts) return next();
            ctx.state.command = {
                text: message.text,
                command: parts[1],
                bot: parts[2],
                argsString: parts[3],
                args: parseArgs(parts[3]),

            };
        }
    }
    return next();
};
