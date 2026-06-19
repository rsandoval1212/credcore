import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: Props) {
  return (
    <div className={`text-center py-12 px-6 ${className}`}>
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
        {icon || <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">{description}</p>}
      {action && (
        <button onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          {action.label}
        </button>
      )}
    </div>
  )
}
