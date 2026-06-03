import { EventEmitter } from "node:events";
import type { DomainEvent } from "./types.js";

class DomainEventBus extends EventEmitter {
  emitDomain(event: DomainEvent) {
    this.emit("domain", event);
  }

  onDomain(listener: (event: DomainEvent) => void) {
    this.on("domain", listener);
    return () => this.off("domain", listener);
  }
}

export const eventBus = new DomainEventBus();
eventBus.setMaxListeners(1000);
