import { Component } from 'react'

export default class ChartErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Chart render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-text-secondary text-sm">
          Chart failed to render. Try changing the time horizon.
        </div>
      )
    }
    return this.props.children
  }
}
