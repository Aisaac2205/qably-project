'use client'

import { useProjects } from '@/lib/use-mock-store'
import { ProjectGrid } from '@/features/projects/components/project-grid'
import Link from 'next/link'
import { Plus, CaretDown, SquaresFour, List } from '@phosphor-icons/react'

export default function ProjectsListPage() {
  const projects = useProjects()

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6 bg-canvas min-h-screen text-default">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-default">Projects</h1>
        
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2 text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          <span>New</span>
        </Link>
      </div>

      {/* Controls / Filter Sub-header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
          <span className="text-border">|</span>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-default transition-colors font-medium cursor-pointer">
            <span>Sort By: Recent Activity</span>
            <CaretDown size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground border border-border/80 rounded-lg p-0.5 bg-surface shadow-2xs">
          <button 
            className="p-1.5 rounded-md bg-zinc-100 text-default hover:text-default transition-colors cursor-pointer"
            aria-label="Grid view"
          >
            <SquaresFour size={16} weight="fill" />
          </button>
          <button 
            className="p-1.5 rounded-md hover:bg-zinc-50 hover:text-default transition-colors cursor-pointer"
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <ProjectGrid />
    </div>
  )
}

