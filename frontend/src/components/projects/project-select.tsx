"use client"

import { useEffect, useState } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { Project } from "@/lib/types/projects"
import { toast } from "sonner"

interface ProjectSelectProps {
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    showAllOption?: boolean
}

export function ProjectSelect({
    value,
    onChange,
    placeholder = "Select Project",
    className,
    disabled,
    showAllOption = false
}: ProjectSelectProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const data = await apiClient.getProjects()
                setProjects(data)
            } catch (error) {
                console.error("Failed to load projects", error)
                toast.error("Failed to load projects list")
            } finally {
                setIsLoading(false)
            }
        }
        loadProjects()
    }, [])

    return (
        <Select onValueChange={onChange} defaultValue={value} value={value} disabled={disabled || isLoading}>
            <SelectTrigger className={className}>
                <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
                {showAllOption && <SelectItem value="all">All Projects</SelectItem>}
                {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                        {project.code ? `${project.code} - ${project.name}` : project.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
