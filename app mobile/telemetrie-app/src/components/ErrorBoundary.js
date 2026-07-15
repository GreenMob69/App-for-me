import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
                    <Text style={styles.title}>Ceva nu a functionat.</Text>
                    <Text style={styles.subtitle}>Incearca din nou sau revino mai tarziu.</Text>
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <Text style={styles.buttonText}>Reincearca</Text>
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
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    title: {
        color: '#f85149',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    subtitle: {
        color: '#8b949e',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
    button: {
        marginTop: 20,
        backgroundColor: '#21262d',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    buttonText: {
        color: '#58a6ff',
        fontWeight: '600',
        fontSize: 13,
    },
});

export default ErrorBoundary;
