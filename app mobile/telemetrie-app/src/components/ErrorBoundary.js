import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing } from '../theme';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>{t('error.title')}</Text>
                    <Text style={styles.subtitle}>{t('error.subtitle')}</Text>
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <Text style={styles.buttonText}>{t('error.retry')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing[8],
    },
    title: {
        color: colors.status.critical,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing[2],
    },
    subtitle: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label1,
        textAlign: 'center',
        lineHeight: typography.lineHeights.label1,
    },
    button: {
        marginTop: spacing[5],
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    buttonText: {
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
        fontSize: typography.sizes.label1,
    },
});

export default ErrorBoundary;
