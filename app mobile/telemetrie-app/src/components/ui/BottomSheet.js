import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, Modal, Animated, StyleSheet,
    TouchableOpacity, TouchableWithoutFeedback,
    Platform, Dimensions, PanResponder,
} from 'react-native';
import { colors, typography, radii, spacing } from '../../theme';
import PropTypes from 'prop-types';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * BottomSheet — înlocuitor animat și interactiv cu gesturi pentru Modal classic.
 * Slide-in din jos la deschidere, gest de tragere (PanResponder) pentru dismiss,
 * rezistență elastică (rubber-band) la tragere în sus.
 */
const BottomSheet = ({ visible, onClose, title, children, maxHeight }) => {
    const [mounted, setMounted] = useState(false);
    const slideAnim   = useRef(new Animated.Value(SCREEN_H)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const panY        = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            slideAnim.setValue(SCREEN_H);
            panY.setValue(0);
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
            panY.setValue(0);
            onClose?.();
        });
    };

    // ── PanResponder pentru tragere cu degetul (drag-to-dismiss) ───────────
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
            onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
            onPanResponderMove: (_, gesture) => {
                if (gesture.dy > 0) {
                    panY.setValue(gesture.dy);
                } else {
                    // Rezistență elastică în sus
                    panY.setValue(gesture.dy * 0.2);
                }
            },
            onPanResponderRelease: (_, gesture) => {
                // Dacă a fost tras în jos peste 75px sau rapid în jos (vy > 0.4)
                if (gesture.dy > 75 || (gesture.dy > 30 && gesture.vy > 0.4)) {
                    handleClose();
                } else {
                    // Snap înapoi la poziția deschisă
                    Animated.spring(panY, {
                        toValue: 0,
                        friction: 8,
                        tension: 50,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    if (!mounted) return null;

    const combinedTranslateY = Animated.add(slideAnim, panY);

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
                    { transform: [{ translateY: combinedTranslateY }] },
                ]}
                accessibilityViewIsModal
                accessibilityRole="none"
            >
                {/* Zonă de tragere cu degetul: Drag Handle + Header */}
                <View {...panResponder.panHandlers} style={styles.dragZone}>
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} accessibilityElementsHidden />
                    </View>

                    {/* Header */}
                    {title ? (
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <TouchableOpacity
                                onPress={handleClose}
                                style={styles.closeBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Închide"
                                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                            >
                                <Text style={styles.closeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>

                {children}
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
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
    dragZone: {
        width: '100%',
    },
    handleContainer: {
        width: '100%',
        paddingTop: spacing[2],
        paddingBottom: spacing[1],
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        width: 48,
        height: 5,
        borderRadius: radii.full,
        backgroundColor: colors.border.strong || '#475569',
        alignSelf: 'center',
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

BottomSheet.propTypes = {
    visible: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string,
    children: PropTypes.node,
    maxHeight: PropTypes.number,
};
