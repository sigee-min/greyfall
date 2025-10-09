import { getSnapshotPolicy } from './policies.js';
function tryBtoa(input) {
    try {
        const g = globalThis;
        return g.btoa ? g.btoa(input) : null;
    }
    catch {
        return null;
    }
}
function tryAtob(input) {
    try {
        const g = globalThis;
        return g.atob ? g.atob(input) : null;
    }
    catch {
        return null;
    }
}
export function maybeCompressValue(value) {
    try {
        const json = JSON.stringify(value);
        const threshold = getSnapshotPolicy().compressOverBytes;
        if (json.length <= threshold)
            return value;
        const b64 = tryBtoa(json);
        if (!b64)
            return value;
        return { __compressed: true, encoding: 'base64json', data: b64 };
    }
    catch {
        return value;
    }
}
export function maybeDecompressValue(value) {
    if (!value || typeof value !== 'object')
        return value;
    const v = value;
    if (v.__compressed !== true || v.encoding !== 'base64json' || typeof v.data !== 'string')
        return value;
    const json = tryAtob(v.data);
    if (!json)
        return value;
    try {
        return JSON.parse(json);
    }
    catch {
        return value;
    }
}
