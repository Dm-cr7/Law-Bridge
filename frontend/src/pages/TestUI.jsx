import React from "react"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"

export default function TestUI() {
  return (
    <div className="min-h-screen flex items-center justify-center gap-6 p-8 bg-black-100 dark:bg-black-900">
      <Card className="max-w-xs">
        <h2 className="text-xl font-heading mb-4">Card Title</h2>
        <p>This is a test card content.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </Card>
    </div>
  )
}
