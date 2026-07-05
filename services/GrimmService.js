import { GrimmRuntime } from "./GrimmRuntime.js";

export class GrimmService {
  constructor(options = {}) {
    this.runtime = options.runtime || new GrimmRuntime(options);
  }

  async respond(input = {}) {
    return this.runtime.respond(input);
  }

  promptFiles(mode = "normal") {
    return this.runtime.promptService.promptFiles(mode);
  }

  hasFile(file) {
    return this.runtime.promptService.hasFile(file);
  }

  health(mode = "normal") {
    return this.runtime.health(mode);
  }
}
