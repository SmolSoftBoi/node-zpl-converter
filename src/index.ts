import { readFileSync } from 'fs';

import { Jimp } from 'jimp';

/**
 * ZPL converter.
 */
export default class ZplConverter {

    /**
     * Map codes.
     */
    private static mapCodes = {
        1: 'G',
        2: 'H',
        3: 'I',
        4: 'J',
        5: 'K',
        6: 'L',
        7: 'M',
        8: 'N',
        9: 'O',
        10: 'P',
        11: 'Q',
        12: 'R',
        13: 'S',
        14: 'T',
        15: 'U',
        16: 'V',
        17: 'W',
        18: 'X',
        19: 'Y',
        20: 'g',
        40: 'h',
        60: 'i',
        80: 'j',
        100: 'k',
        120: 'l',
        140: 'm',
        160: 'n',
        180: 'o',
        200: 'p',
        220: 'q',
        240: 'r',
        260: 's',
        280: 't',
        300: 'u',
        320: 'v',
        340: 'w',
        360: 'x',
        380: 'y',
        400: 'z'
    };

    /**
     * Black limit.
     */
    private blackLimit = 380;

    /**
     * Total.
     */
    private total?: number;

    /**
     * Width bytes.
     */
    private widthBytes?: number;

    /**
     * Compress hex?
     */
    private compressHex = false;

    /**
     * ZPL converter.
     * @param originalImageFile Original image file.
     */
    static async main(originalImageFile: Buffer | string): Promise<string> {
        let originalImage: Buffer;

        switch (typeof originalImageFile) {
            case 'string':
                originalImage = readFileSync(originalImageFile);
                break;
            default:
                originalImage = originalImageFile;
        }

        const zpl = new ZplConverter();
        zpl.setCompressHex(true);
        zpl.setBlacknessLimitPercentage(50);

        return await zpl.convertFromImg(originalImage);
    }

    /**
     * Convert from image.
     * @param image Image.
     */
    async convertFromImg(image: Buffer): Promise<string> {
        const body = await this.createBody(image);

        if (this.compressHex) {
            this.encodeHexAscii(body);
        }

        return `${this.headDoc()}${body}${this.footDoc()}`;
    }

    /**
     * Set compress hex.
     * @param compressHex Compress hex?
     */
    setCompressHex(compressHex: boolean): void {
        this.compressHex = compressHex;
    }

    /**
     * Set blackness limit percentage.
     * @param percentage Percentage.
     */
    setBlacknessLimitPercentage(percentage: number): void {
        this.blackLimit = percentage * 768 / 100;
    }

    /**
     * Create body.
     * @param originalImage Original image.
     */
    private async createBody(originalImage: Buffer): Promise<string> {
        let buffer = new Buffer('');

        const graphics = await Jimp.read(originalImage);
        const width = graphics.width;
        const height = graphics.height;

        let index = 0;
        let auxBinaryChars = ['0', '0', '0', '0', '0', '0', '0', '0'];

        if (width % 8 > 0) {
            this.widthBytes = Math.floor(width / 8) + 1;
        } else {
            this.widthBytes = width / 8;
        }

        this.total = this.widthBytes * height;

        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                const pixelColor = graphics.getPixelColor(w, h);
                const red = pixelColor >> 16 & 0x000000FF;
                const green = pixelColor >> 8 & 0x000000FF;
                const blue = pixelColor & 0x000000FF;

                let auxChar = '1';

                const totalColor = red + green + blue;

                if (totalColor > this.blackLimit) {
                    auxChar = '0';
                }

                auxBinaryChars[index] = auxChar;

                index++;

                if (index === 8 || w === width - 1) {
                    const fourByteBinary = this.fourByteBinary(auxBinaryChars.toString());

                    buffer = Buffer.concat([
                        buffer,
                        new Buffer(fourByteBinary)
                    ]);

                    auxBinaryChars = ['0', '0', '0', '0', '0', '0', '0', '0'];
                    index = 0;
                }
            }

            buffer = Buffer.concat([
                buffer,
                new Buffer('\n')
            ]);
        }

        return buffer.toString();
    }

    /**
     * Four byte binary.
     * @param binary Binary.
     */
    private fourByteBinary(binary: string): string {
        const decimal = parseInt(binary, 2);

        let fourByteBinary = '';

        if (decimal <= 15) {
            fourByteBinary = '0';
        }

        fourByteBinary += decimal.toString(16).toUpperCase()

        return fourByteBinary;
    }

    /**
     * Encode Hex ASCII.
     * @param code Code.
     */
    private encodeHexAscii(code: string): string {
        if (!this.widthBytes) {
            throw new Error('Width bytes not set.');
        }

        const maxLinea = this.widthBytes * 2;

        let codeBuffer = new Buffer('');
        let lineaBuffer = new Buffer('');
        let previousLine: string | null = null;
        let counter = 1;
        let aux = code.charAt(0);
        let firstChar = false;

        for (let i = 1; i < code.length; i++) {
            if (firstChar) {
                aux = code.charAt(i);
                firstChar = false;
                continue;
            }

            if (code.charAt(i) === '\n') {
                if (counter >= maxLinea && aux === '0') {
                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer(',')
                    ]);
                } else if (counter >= maxLinea && aux === 'F') {
                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer('!')
                    ]);
                } else if (counter > 20) {
                    const multi20 = (counter / 20) * 20;
                    const resto20 = counter % 20;

                    if (ZplConverter.mapCodes[multi20]) {
                        lineaBuffer = Buffer.concat([
                            lineaBuffer,
                            new Buffer(ZplConverter.mapCodes[multi20])
                        ]);
                    }

                    if (resto20 !== 0) {
                        if (ZplConverter.mapCodes[resto20]) {
                            lineaBuffer = Buffer.concat([
                                lineaBuffer,
                                new Buffer(ZplConverter.mapCodes[resto20])
                            ]);
                        }
                    }

                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer(aux)
                    ]);
                } else {
                    if (ZplConverter.mapCodes[counter]) {
                        lineaBuffer = Buffer.concat([
                            lineaBuffer,
                            new Buffer(ZplConverter.mapCodes[counter])
                        ]);
                    }

                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer(aux)
                    ]);
                }

                counter = 1;
                firstChar = true;

                if (lineaBuffer.toString() === previousLine) {
                    codeBuffer = Buffer.concat([
                        codeBuffer,
                        new Buffer(':')
                    ]);
                } else {
                    codeBuffer = Buffer.concat([
                        codeBuffer,
                        new Buffer(lineaBuffer.toString())
                    ]);
                }

                previousLine = lineaBuffer.toString();
                lineaBuffer = new Buffer('');
                continue;
            }

            if (aux === code.charAt(i)) {
                counter++;
            } else {
                if (counter > 20) {
                    const multi20 = (counter / 20) * 20;
                    const resto20 = counter % 20;

                    if (ZplConverter.mapCodes[multi20]) {
                        lineaBuffer = Buffer.concat([
                            lineaBuffer,
                            new Buffer(ZplConverter.mapCodes[multi20])
                        ]);
                    }

                    if (resto20 !== 0) {
                        if (ZplConverter.mapCodes[resto20]) {
                            lineaBuffer = Buffer.concat([
                                lineaBuffer,
                                new Buffer(ZplConverter.mapCodes[resto20])
                            ]);
                        }
                    }

                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer(aux)
                    ]);
                } else {
                    if (ZplConverter.mapCodes[counter]) {
                        lineaBuffer = Buffer.concat([
                            lineaBuffer,
                            new Buffer(ZplConverter.mapCodes[counter])
                        ]);
                    }

                    lineaBuffer = Buffer.concat([
                        lineaBuffer,
                        new Buffer(aux)
                    ]);
                }

                counter++;
                aux = code.charAt(i);
            }
        }

        return codeBuffer.toString();
    }

    /**
     * Head doc.
     */
    private headDoc(): string {
        return `^XA ^FO0,0^GFA,${this.total},${this.total},${this.widthBytes}, `;
    }

    /**
     * Foot doc.
     */
    private footDoc(): string {
        return '^FS^XZ';
    }
}