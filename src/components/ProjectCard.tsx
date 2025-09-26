import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Database, Plus, FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;  
  github: boolean;
  supabase: boolean;
}

interface ProjectCardProps {
  project?: Project;
  isNewProject?: boolean;
  onClick: () => void;
}

const ProjectCard = ({ project, isNewProject = false, onClick }: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isNewProject) {
    return (
      <Card 
        className="card-project cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 min-h-[200px] flex items-center justify-center group"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4 group-hover:bg-primary/20 transition-colors">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Novo Projeto</h3>
          <p className="text-sm text-muted-foreground">
            Crie um novo projeto com IA Pilot
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!project) return null;

  return (
    <Card 
      className="card-project cursor-pointer min-h-[200px] group"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          </div>
          <FolderOpen className={`h-5 w-5 text-muted-foreground transition-all ${isHovered ? 'text-primary scale-110' : ''}`} />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge 
            variant={project.github ? "default" : "secondary"}  
            className={project.github ? "badge-success" : "badge-error"}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            GitHub {project.github ? "Conectado" : "Pendente"}
          </Badge>
          <Badge 
            variant={project.supabase ? "default" : "secondary"}
            className={project.supabase ? "badge-success" : "badge-error"}
          >
            <Database className="h-3 w-3 mr-1" />
            Supabase {project.supabase ? "Conectado" : "Pendente"}
          </Badge>
        </div>

        <div className="mt-auto">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          >
            Abrir Projeto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
