export class LeakSweeper {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    tick() {
        this.opts.stage.probe(this.opts.olderThanMs);
    }
}
