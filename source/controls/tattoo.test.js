const { TattooManager } = require("./tattoo");

test('adds 1 + 2 to equal 3', () => {
    expect(TattooManager.commands.selectTattoo(1,2));
});