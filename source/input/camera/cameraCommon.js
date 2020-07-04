const ChannelBits = 20 ;
const ChannelMax = 2**ChannelBits ;

const ColorCodeWidth = 5 ;
const ColorCodeHeight = 5 ;
const ColorCodeCells = ColorCodeWidth * ColorCodeHeight ;

// 32 bits
const TotalCodeBits = (ColorCodeWidth-1)*(ColorCodeHeight-1)*2 ;

const ScreenCountBits = TotalCodeBits - ChannelBits ;
const myChannelCode = Math.floor(Math.random()*ChannelMax);
const ScreenCountMax = 2**ScreenCountBits ;

const colorBlockColors = [
    "#000000",
    "#000080",
    "#008000",
    "#800000",
    "#800080",
    "#008080",
    "#808000",
    "#808080",
];
