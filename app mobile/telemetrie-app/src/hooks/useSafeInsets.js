import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * useSafeInsets
 * Hook rezistent la erori: apeleaza useSafeAreaInsets() daca SafeAreaProvider
 * este montat, iar in caz contrar returneaza inaltimea nativa a barei de stare
 * (StatusBar.currentHeight pe Android sau 44 pe iOS) fara sa arunce eroare!
 */
export function useSafeInsets() {
    try {
        const insets = useSafeAreaInsets();
        if (insets && typeof insets.top === 'number') {
            return insets;
        }
    } catch (_) {}

    const fallbackTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 44;
    return {
        top: fallbackTop,
        bottom: 16,
        left: 0,
        right: 0,
    };
}
