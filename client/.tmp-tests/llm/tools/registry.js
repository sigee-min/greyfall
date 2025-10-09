const MAP = new Map();
export const InMemoryToolRegistry = {
    register(tool) {
        MAP.set(tool.id, tool);
    },
    get(id) {
        return MAP.get(id) ?? null;
    },
    list() {
        return Array.from(MAP.values());
    }
};
