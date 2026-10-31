// Loaded only by the isolated R11 child process, never by production startup.
process.on("SIGUSR2", () => {
  const end = Date.now() + 15000;
  while (Date.now() < end) { /* genuine blocked event loop */ }
});
