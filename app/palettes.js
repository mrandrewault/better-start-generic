// The first 40 families are Andrew's deduplicated Color Hunt selections.
// The final eight are Meanwhile variations built from the same visual vocabulary.
export const EDITION_PALETTES = [
  ["#E3F2FD","#90CAF9","#2196F3","#0D47A1"], ["#F599C6","#FFEA88","#7DCCAD","#4D6787"],
  ["#3368A0","#66A3BF","#C8DFDB","#F2EFE7"], ["#464B71","#118AB2","#7CD5C7","#F2F2ED"],
  ["#DF301C","#FF9100","#FFF1D1","#00B7CD"], ["#224248","#325E6A","#44A1A4","#FF9A00"],
  ["#E8F5E9","#A5D6A7","#66BB6A","#1B5E20"], ["#5D3140","#CF4173","#F39399","#F6D8BD"],
  ["#E73F1E","#FB6C00","#F9B637","#FFDD9C"], ["#FED24F","#FFF449","#B2D959","#7EC151"],
  ["#063B00","#266210","#90B800","#E1E100"], ["#F8B2B2","#AF719D","#8B639B","#403D88"],
  ["#60241E","#95271D","#B34A44","#E77B49"], ["#F5F5DC","#FBC02D","#FF8F00","#C62828"],
  ["#499A13","#BBDC12","#8ECA3C","#276F27"], ["#F9E8A2","#B4E1EB","#95BDD7","#78A4CB"],
  ["#0B1849","#124D1C","#E4B028","#EBEDE3"], ["#E5CB90","#FFF3C8","#34A99D","#458393"],
  ["#BE1A1A","#D0311E","#F7D87F","#F8EBAB"], ["#F5F5F5","#76ABAE","#303841","#FF5722"],
  ["#4A4466","#6EADBC","#9FCBAD","#F1F7D4"], ["#121358","#232F72","#2F578A","#36ADA3"],
  ["#0D0B61","#294669","#478B8D","#E4D329"], ["#EEEEEE","#6FCF97","#2FA084","#1F6F5F"],
  ["#59B292","#FFC94D","#FAE7CB","#FA6781"], ["#0A7C6E","#F59E0B","#FF6B35","#FAFAFA"],
  ["#AAFFC7","#67C090","#215B63","#124170"], ["#170C79","#EFE3CA","#56B6C6","#8ACBD0"],
  ["#1E104E","#452E5A","#FF653F","#FFC85C"], ["#2F2FE4","#162E93","#1A1953","#080616"],
  ["#03AED2","#F8DE22","#F45B26","#D12052"], ["#F13E93","#F891BB","#F9D0CD","#FAFFCB"],
  ["#FE81D4","#FAACBF","#FBC3C1","#FFEABB"], ["#406093","#4C8CE4","#91D06C","#FFF799"],
  ["#003049","#D62828","#F77F00","#FCBF49"], ["#FFDE42","#53CBF3","#5478FF","#111FA2"],
  ["#81A6C6","#AACDDC","#F3E3D0","#D2C4B4"], ["#C00707","#FF4400","#FFB33F","#134E8E"],
  ["#355872","#7AAACE","#9CD5FF","#F7F8F0"], ["#FFD400","#FFC300","#FF8C00","#FF5F00"],
  ["#17324D","#3E7C8F","#F2C14E","#F7F1E3"], ["#4D194D","#893168","#D87CAC","#F4E3B2"],
  ["#183A37","#2E7D69","#A9D18E","#F4E8C1"], ["#14213D","#3A86FF","#FFB703","#FBF8F1"],
  ["#5A2A27","#C8553D","#F4D35E","#8FC0A9"], ["#253237","#5C6B73","#9DB4C0","#E0FBFC"],
  ["#2D1E2F","#7A306C","#D983A6","#F2E9D8"], ["#073B4C","#118AB2","#06D6A0","#FFD166"]
];

const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = hex => rgb(hex).map(value => value / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
const toHex = ({h, s, l}) => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return `#${[r,g,b].map(value => Math.round((value + m) * 255).toString(16).padStart(2,"0")).join("")}`.toUpperCase();
};
const toHsl = hex => {
  const [r,g,b] = rgb(hex).map(value => value / 255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min, l = (max + min) / 2;
  let h = !d ? 0 : max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  h = (h * 60 + 360) % 360;
  return {h, s:d ? d/(1-Math.abs(2*l-1))*100 : 0, l:l*100};
};
const readable = (hex, paper) => {
  if (contrast(hex, paper) >= 4.5) return hex;
  const hsl = toHsl(hex);
  let lightness = Math.min(34, hsl.l);
  let candidate = toHex({...hsl, s:Math.max(62, hsl.s), l:lightness});
  while (contrast(candidate, paper) < 4.5 && lightness > 14) {
    lightness -= 2;
    candidate = toHex({...hsl, s:Math.max(62, hsl.s), l:lightness});
  }
  return candidate;
};
const hueDistance = (a, b) => { const d = Math.abs(toHsl(a).h - toHsl(b).h); return Math.min(d, 360 - d); };

// Preserve the chosen family, but repair low contrast and inject a harmonious
// complementary accent when a family is too tonally narrow for the overlap.
export const mastheadPalette = (palette, paper = "#F7F4EC") => {
  const sources = palette.map(toHsl), result = [];
  for (let index = 0; index < 9; index += 1) {
    const source = sources[index % sources.length];
    let hue = source.h;
    if (result.length && hueDistance(toHex({h:hue,s:70,l:34}), result.at(-1)) < 22) hue = (hue + (index % 2 ? 46 : 180)) % 360;
    let lightness = [34,40,30,43,36,32,41,29,38][index];
    let candidate = toHex({h:hue,s:Math.min(88,Math.max(60,source.s)),l:lightness});
    while (contrast(candidate,paper) < 4.8 && lightness > 24) {
      lightness -= 2;
      candidate = toHex({h:hue,s:Math.min(88,Math.max(60,source.s)),l:lightness});
    }
    result.push(candidate);
  }
  return result;
};
