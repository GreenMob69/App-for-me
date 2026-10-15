const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/expo-notifications/build/TopicSubscriptionModule.android.js');

if (fs.existsSync(targetFile)) {
    const content = fs.readFileSync(targetFile, 'utf8');
    if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
        const patched = `import { requireOptionalNativeModule } from 'expo-modules-core';

let moduleInstance = null;
try {
    moduleInstance = typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule('ExpoTopicSubscriptionModule')
        : null;
} catch {
    moduleInstance = null;
}

if (!moduleInstance) {
    moduleInstance = {
        addListener: () => {},
        removeListeners: () => {},
        subscribeToTopicAsync: () => Promise.resolve(null),
        unsubscribeFromTopicAsync: () => Promise.resolve(null),
    };
}

export default moduleInstance;
`;
        fs.writeFileSync(targetFile, patched, 'utf8');
        console.log('[PATCH] Patched TopicSubscriptionModule.android.js for Expo Go SDK 57 compatibility.');
    }
}
