const { JSDOM } = require('jsdom');
const { parseDate, parseTable } = require('../bot.mjs');
const config = require('../config.json');

describe('parseDate', () => {
    test('returns the current date if input is empty', () => {
        const now = new Date();
        const parsedDate = parseDate('');
        expect(parsedDate.getDate()).toBe(now.getDate());
        expect(parsedDate.getMonth()).toBe(now.getMonth());
        expect(parsedDate.getFullYear()).toBe(now.getFullYear());
    });

    const testCases = [
        ['2023-04-30', new Date(2023, 3, 30)],
        ['30 april 2023', new Date(2023, 3, 30)],
        ['30. April 2023', new Date(2023, 3, 30)],
        ['April 30, 2023', new Date(new Date().getFullYear(), 3, 30)],
        ['Apr 30, 2023', new Date(new Date().getFullYear(), 3, 30)],
        ['30/04/2023', new Date(2023, 3, 30)],
        ['30.04.2023', new Date(2023, 3, 30)],
        ['30-04-2023', new Date(2023, 3, 30)],
        ['30 Apr', new Date(new Date().getFullYear(), 3, 30)],
        ['April 30', new Date(new Date().getFullYear(), 3, 30)],
        ['30 апреля', new Date(new Date().getFullYear(), 3, 30)],
        ['30 Апр', new Date(new Date().getFullYear(), 3, 30)],
    ];

    test.each(testCases)('parses "%s" as %s', (input, expected) => {
        const parsedDate = parseDate(input);
        expect(parsedDate).toEqual(expected);
    });
    // Add more tests for the parseDate function to cover various date formats and languages.
});

describe('locations', () => {
    test('loads locations from the config file', () => {
        //Squash
        expect(config.locations.squash).toContain('SquashCity');
        expect(config.locations.squash).toContain('Amstelpark');

        //Tennis
        expect(config.locations.tennis).toContain('Amstelpark');

        //Padel
        expect(config.locations.padel).toContain('Amstelpark');
    });
});

describe('parseTable', () => {
    test('parses a table with free slots, groups them by lane number, and omits unwanted data', () => {
        const table = createSampleTable();
        const parsedTable = parseTable(table);
        const expectedParsedTable = [
            {
                name: "Baan 1",
                timeSlots: ["07:15", "08:00"]
            },
            {
                name: "Baan 2",
                timeSlots: ["07:15", "08:00", "08:45"]
            }
        ];

        expect(parsedTable).toEqual(expectedParsedTable);
    });
});

function createSampleTable() {

    const htmlTable =`<table unselectable id="tbl_matrix" class="matrix-container" data-sport="15"><tr><td class="matrix-column">
<table unselectable class="matrix">
<thead class="matrix-header">
<tr class="matrix-name-row">
<th class="matrix-timeslot header-name empty"></th>
<th class="header-name  r-51 s-15">Baan 1<div class="matrix-header-force-width"></div></th>
<th class="header-name  r-52 s-15">Baan 2<div class="matrix-header-force-width"></div></th>
<th class="header-name  r-63 s-15">Baan 13<div class="matrix-header-force-width"></div></th></tr></thead>
<tr utc="1681708500" data-time="07:15">
<th class="matrix-timeslot empty"></th>
<td class="slot normal r-51 s-15 free off-peak" type="free" slot="51" rowspan="3"><div class="slot-period"> 07:15</div></td>
<td class="slot normal r-52 s-15 free off-peak" type="free" slot="52" rowspan="3"><div class="slot-period"> 07:15</div></td>
<td class="slot normal r-63 s-15 closed" title="07:15 - 07:30"></td>
</tr><tr utc="1681711200" data-time="08:00">
<th class="matrix-timeslot empty"></th>
<td class="slot normal r-51 s-15 free off-peak" type="free" slot="51" rowspan="3"><div class="slot-period"> 08:00</div></td>
<td class="slot normal r-52 s-15 free off-peak" type="free" slot="52" rowspan="3"><div class="slot-period"> 08:00</div></td>
</tr><tr utc="1681713900" data-time="08:45">
<th class="matrix-timeslot empty"></th>
<td class="slot normal r-51 s-15 taken" type="taken" finishes="1681716600" id="matrix-res-9150762" rowspan="3"><div class="slot-period"> 08:45</div><div class="players"> <b>Reserved</b></div></td>
<td class="slot normal r-52 s-15 free off-peak" type="free" slot="52" rowspan="3"><div class="slot-period"> 08:45</div></td>
<td class="slot normal r-63 s-15 taken" type="taken" finishes="1681720200" id="matrix-res-8046721" rowspan="6"><div class="slot-period"> 09:00</div><div class="players"> <b>Reserved</b></div></td>
</tr><tr utc="1681765200" data-time="23:00">
<th class="matrix-timeslot empty"></th>
<td class="slot normal r-51 s-15 closed" title="23:00 - 23:15"></td>
<td class="slot normal r-52 s-15 closed" title="23:00 - 23:15"></td>
</tr>
<tfoot class="matrix-header"
><tr class="matrix-name-row">
<th class="matrix-timeslot header-name empty">

</th><th class="header-name  r-51 s-15">Baan 1<div class="matrix-header-force-width"></div></th>
<th class="header-name  r-52 s-15">Baan 2<div class="matrix-header-force-width"></div></th>
<th class="header-name  r-63 s-15">Baan 13<div class="matrix-header-force-width"></div></th></tr></tfoot>
</table>
</td>
</tr></table>`

    const dom = new JSDOM(htmlTable);
    const table = dom.window.document.querySelector('table');
    return table;
}





