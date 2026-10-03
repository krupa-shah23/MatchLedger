import { Bench } from "tinybench";
const bench=new Bench(); bench.add("hello",()=>"hello"); await bench.run(); console.table(bench.table());
