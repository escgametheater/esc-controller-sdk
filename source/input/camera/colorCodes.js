function setColorBit(parent,bit,x,y,w,h) {
    const id2 = parent.id + "-" + x + "-" + y ;
    let el = document.getElementById(id2);
    if (!el) {
        el = document.createElement("div");
        el.id = id2 ;
        const border = 0.1 ;

        el.style.position = "absolute";
        el.style.top = (100*y/h+100/h*border)+"%";
        el.style.left = (100*x/w+100/w*border)+"%";
        el.style.height = (100/h)*(1-2*border)+"%";
        el.style.width = (100/w)*(1-2*border)+"%";
        parent.appendChild(el);
    }
    el.style.backgroundColor = colorBlockColors[bit] ;
}

function intToBits2(i) {
    //console.log(i,Number.isInteger(i));
    //i = i.toInteger();
    const a = [];
    while (i >= 0.9) {
        a.push(i&3);
        i = i / 4 ;
    }
    //console.log(a);
    return a;
}

let colorBitsSet = {} ;
let colorCodeIdCount = 0 ;
function setColorBits(parent,bits,w,h) {
    if (!parent.id) {
        parent.id = "_colorCode" + colorCodeIdCount;
        colorCodeIdCount++;
    }
    let colorArray = [];
    let i = 0 ;
    let columnCheckSums = [];
    for (let x = 0 ; x < w ; x++) {
        columnCheckSums[x] = 0 ;
    }
    for (let y = 0 ; y < h ; y++) {
        colorArray[y] = [];
        let rowCheckSum = 0 ;
        for (let x = 0 ; x < w ; x++) {
            let bit = 0 ;
            if (y === h - 1) {
                bit = 3 - (columnCheckSums[x] & 3);
            }
            else if (x === w - 1) {
                bit = 3 - (rowCheckSum & 3);
                columnCheckSums[x] = (columnCheckSums[x] || 0) + bit;
            }
            else {
                if (bits.length <= i ) {
                    bit = 0;// Math.floor(Math.random() * 4);
                }
                else {
                    bit = bits[i];
                }
                columnCheckSums[x] = (columnCheckSums[x] || 0) + bit;
                rowCheckSum += bit ;
                i++;
            }
            if (!(bit >= 0 && bit <= 3))
                debugger;

            let codedBit = bit + 1 ;
            const bitAbove = (y > 0) ? colorArray[y-1][x] : 7 ;
            const bitLeft = (x > 0) ? colorArray[y][x-1] : 7 ;
            // Make sure we never have two adjacent cells with same color
            if (codedBit >= bitAbove) {
                codedBit++ ;
            }
            if (codedBit >= bitLeft) {
                codedBit++ ;
            }
            if (codedBit === bitAbove) {
                codedBit++ ;
            }
            colorArray[y][x] = codedBit;
            setColorBit(parent,codedBit, x, y, w, h);
        }
        if (!colorBitsSet[parent] && (y < h-1) ) {
//            parent.appendChild(document.createElement("br"));
        }
    }
    colorBitsSet[parent] = true;
    return colorArray ;
}
function setCode(parent, code) {
    if (code >= 0) {
    }
    else {
        if (code.charAt(0) === "#") {
            code= parseInt(code.slice(1),16);
        }
    }
    setColorBits(parent,intToBits2(code),ColorCodeWidth,ColorCodeHeight);
}

document.addEventListener('DOMContentLoaded', function() {
    const onloadDivs = document.querySelectorAll("[data-color-blocks-code]");
    onloadDivs.forEach((el) => {
        //el.style.display = "grid";
        //el.style.gridGap = "0";
        //el.style.gridTemplateColumns = "1fr 1fr 1fr 1fr 1fr";
        if (!el.style.backgroundColor) {
            el.style.backgroundColor = "black" ;
        }
        console.log("Setting code in element",el);
        setCode(el,el.attributes['data-color-blocks-code'].value);

    });
}, false);

