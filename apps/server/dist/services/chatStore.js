"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatStore = void 0;
const crypto_1 = __importDefault(require("crypto"));
const stateStore_js_1 = require("../models/stateStore.js");
/** Saved assistant conversations — encrypted at rest with the rest of the state (see stateStore). */
const MAX_MESSAGES = 200;
const threads = () => {
    const s = stateStore_js_1.stateStore.getState();
    if (!s.chats)
        s.chats = [];
    return s.chats;
};
exports.chatStore = {
    get(ownerId, patientId) {
        return threads().find((t) => t.ownerId === ownerId && t.patientId === patientId);
    },
    append(ownerId, patientId, messages) {
        let t = this.get(ownerId, patientId);
        if (!t) {
            t = { ownerId, patientId, messages: [], updatedAt: new Date().toISOString() };
            threads().push(t);
        }
        const added = messages.map((m) => ({ ...m, id: crypto_1.default.randomUUID(), createdAt: new Date().toISOString() }));
        t.messages.push(...added);
        if (t.messages.length > MAX_MESSAGES)
            t.messages.splice(0, t.messages.length - MAX_MESSAGES);
        t.updatedAt = new Date().toISOString();
        stateStore_js_1.stateStore.saveState();
        return added;
    },
    clear(ownerId, patientId) {
        const all = threads();
        const i = all.findIndex((t) => t.ownerId === ownerId && t.patientId === patientId);
        if (i >= 0) {
            all.splice(i, 1);
            stateStore_js_1.stateStore.saveState();
        }
    }
};
