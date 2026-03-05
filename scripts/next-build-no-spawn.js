const path = require("path");

// Force-disable eslint in build to match previous behavior.
process.env.NEXT_DISABLE_ESLINT = "1";
// Avoid worker_threads or child_process workers in restricted Windows envs.
process.env.IS_NEXT_WORKER = "true";

const workerModulePath = require.resolve("next/dist/lib/worker");

class InProcessWorker {
  constructor(workerPath, options) {
    this._worker = require(workerPath);
    this._onActivity = options.onActivity;
    this._onActivityAbort = options.onActivityAbort;

    for (const method of options.exposedMethods || []) {
      if (method.startsWith("_")) continue;
      const fn = this._worker[method];
      if (typeof fn !== "function") continue;
      this[method] = async (...args) => {
        if (this._onActivity) this._onActivity();
        try {
          return await fn(...args);
        } finally {
          // no-op
        }
      };
    }
  }

  setOnActivity(onActivity) {
    this._onActivity = onActivity;
  }

  setOnActivityAbort(onActivityAbort) {
    this._onActivityAbort = onActivityAbort;
  }

  end() {
    return Promise.resolve();
  }
}

require.cache[workerModulePath] = {
  exports: {
    Worker: InProcessWorker,
    getNextBuildDebuggerPortOffset: () => 0
  }
};

const build = require("next/dist/build").default;

build(process.cwd())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
