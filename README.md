# Racquet Amsterdam Bot
Telegram Bot for Racquet Amsterdam Group (https://t.me/racquet_ams)

A simple Telegram bot for checking the schedule of squash and tennis clubs in Amsterdam.

Supported locations:
 - SquashCity
 - Amstelpark

Supported sports:
 - squash
 - tennis

Supported commands:

```
/{sport} locations
```
Returns a list of known locations.

```
/{sport} {location}
```
Returns the free courts schedule for the specified location for the current day.

```
/{sport} {location} {date}
```
Returns the free courts schedule for the specified location for the selected date.

The date parameter accepts values:
 - today (default)
 - tomorrow
 - yyyy-MM-dd (2023-04-30)
 - dd MMMM yyyy  (30 April 2023)
 - dd MMM  (30 Apr)
 - dd MMMM (30 April)
 - MMM dd (Apr 30)
 - MMMM dd (April 30)
 - dd.MM.yyyy (30.04.2023)
 - dd-MM-yyyy (30-04-2023)
 - dd/MM/yyyy (30/04/2023)
