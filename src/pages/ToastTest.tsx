import { useToast } from '../components/ToastProvider'

export default function ToastTest() {
    const { addToast, removeAllToasts } = useToast()

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h1>Toast System Test Page</h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button id="btn-info" onClick={() => addToast('info', 'This is an information message.')}>
                    Show Info
                </button>
                <button id="btn-success" onClick={() => addToast('success', 'Action completed successfully!')}>
                    Show Success
                </button>
                <button id="btn-warning" onClick={() => addToast('warning', 'Be careful! This action is irreversible.')}>
                    Show Warning
                </button>
                <button id="btn-danger" onClick={() => addToast('danger', 'Error: Transaction failed. Please try again.')}>
                    Show Danger
                </button>
            </div>
            <div style={{ marginTop: '2rem' }}>
                <button id="btn-dismiss-all" onClick={removeAllToasts} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                    Remove All Toasts
                </button>
            </div>
            
            <section style={{ marginTop: '3rem', maxWidth: '600px' }}>
                <h2>Design Verification Checklist</h2>
                <ul style={{ lineHeight: '1.8' }}>
                    <li>✅ <strong>Glassmorphism</strong>: Backgrounds should be semi-transparent with blur.</li>
                    <li>✅ <strong>SVG Icons</strong>: Clear vector icons instead of emojis.</li>
                    <li>✅ <strong>Mobile Placement</strong>: (Resize window) Should move to bottom-center on mobile.</li>
                    <li>✅ <strong>Stacking</strong>: Max 3 toasts, oldest removed first.</li>
                    <li>✅ <strong>Dismiss All</strong>: Appears when &gt;1 toast is active.</li>
                    <li>✅ <strong>Accessibility</strong>: Prefers-reduced-motion respected (fades instead of slides).</li>
                </ul>
            </section>
        </div>
    )
}
