export class SortedPrices {
    prices = [];
    descending;
    constructor(side) {
        this.descending = side === "SELL";
    }
    insert(price) {
        const position = this.search(price);
        if (position.found) {
            throw new Error(`Price ${price.toString()} already exists`);
        }
        this.prices.splice(position.index, 0, price);
    }
    remove(price) {
        const position = this.search(price);
        if (position.found) {
            this.prices.splice(position.index, 1);
        }
    }
    best() {
        return this.prices[this.prices.length - 1];
    }
    has(price) {
        return this.search(price).found;
    }
    toArray() {
        return this.prices.slice();
    }
    search(price) {
        let low = 0;
        let high = this.prices.length;
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            const current = this.prices[middle];
            if (current === undefined) {
                throw new Error("Binary search reached an invalid position");
            }
            if (current === price) {
                return { index: middle, found: true };
            }
            const comesBefore = this.descending ? current > price : current < price;
            if (comesBefore) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        return { index: low, found: false };
    }
}
