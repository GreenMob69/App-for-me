import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, Modal, Animated, StyleSheet,
    TouchableOpacity, TouchableWithoutFeedback,
    Platform, Dimensions,
} from 'react-native';
import { colors, typography, radii, spacing } from '../../theme';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * BottomSheet — înlocuitor animat pentru Modal classic.
 * Slide-in din jos la deschidere, slide-out la închidere.
 * Apelează onClose() după ce animația de ieșire s-a terminat.
 */
const BottomSheet = ({ visible, onClose, title, children, maxHeight }) => {
    const [mounted, setMounted] = useState(false);
    const slideAnim   = useRef(new Animated.Value(SCREEN_H)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            slideAnim.setValue(SCREEN_H);
            Animated.parallel([
                Animated.timing(slideAnim,   { toValue: 0,   duration: 300, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 1,   duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            // Vizibilitate scoasă din exterior — animăm ieșirea fără callback onClose
            Animated.parallel([
                Animated.timing(slideAnim,   { toValue: SCREEN_H, duration: 240, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 0,        duration: 200, useNativeDriver: true }),
            ]).start(() => setMounted(false));
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim,   { toValue: SCREEN_H, duration: 240, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 0,        duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setMounted(false);
            onClose?.();
        });
    };

    if (!mounted) return null;

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Overlay */}
            <TouchableWithoutFeedback onPress={handleClose} accessible={false}>
                <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
            </TouchableWithoutFeedback>

            {/* Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    maxHeight ? { maxHeight } : styles.defaultMaxHeight,
                    { transform: [{ translateY: slideAnim }] },
                ]}
                accessibilityViewIsModal
                accessibilityRole="none"
            >
                {/* Drag handle */}
                <View style={styles.handle} accessibilityElementsHidden />

                {/* Header */}
                {title ? (
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Închide"
                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {children}
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bg[0],
        borderTopLeftRadius:  radii.xl,
        borderTopRightRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    defaultMaxHeight: {
        maxHeight: SCREEN_H * 0.9,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: radii.full,
        backgroundColor: colors.border.strong,
        alignSelf: 'center',
        marginTop: spacing[2],
        marginBottom: spacing[2],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing[5],
        paddingBottom: spacing[4],
    },
    title: {
        fontSize: typography.sizes.title3,
        fontWeight: '600',
        color: colors.text.primary,
    },
    closeBtn: {
        width: 30,
        height: 30,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnText: {
        color: colors.text.secondary,
        fontWeight: '700',
        fontSize: typography.sizes.label2,
    },
});

export default BottomSheet;
