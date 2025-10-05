export function guideDisplayName(kind) {
    switch (kind) {
        case 'hasty':
            return '강림';
        case 'fast':
            return '백무상';
        case 'smart':
            return '흑무상';
        default:
            return '심판자';
    }
}
