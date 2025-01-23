export function truncateStr(numStr: string) {
    const regex = /^(-?\d+\.\d{0,5})\d*/;
    const match = numStr.match(regex);
    return match ? match[1] : numStr;
}

export function filterProperties<T>(obj: any, keys: (keyof T)[]): Partial<T> {
    return keys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            acc[key] = obj[key];
        }
        return acc;
    }, {} as Partial<T>);
}

export function getRandomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getDateAsKeyString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function convertEpochToDate(epochStr: string): Date {
    // Convert to an integer
    const epochInt: number = parseInt(epochStr, 10);

    // Determine if the epoch time is in seconds or milliseconds
    const date: Date = epochStr.length === 10 ? new Date(epochInt * 1000) : new Date(epochInt);

    return date;
}