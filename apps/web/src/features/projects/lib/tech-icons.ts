import type { TechKey } from '@qably/types'

export const TECH_ICONS: Record<TechKey, { label: string; src: string }> = {
  react:      { label: 'React',      src: '/tech-icons/react.svg' },
  typescript: { label: 'TypeScript', src: '/tech-icons/typescript.svg' },
  javascript: { label: 'JavaScript', src: '/tech-icons/javascript.svg' },
  angular:    { label: 'Angular',    src: '/tech-icons/angular.svg' },
  nestjs:     { label: 'NestJS',     src: '/tech-icons/nestjs.svg' },
  express:    { label: 'Express',    src: '/tech-icons/express.svg' },
  java:       { label: 'Java',       src: '/tech-icons/java.svg' },
  php:        { label: 'PHP',        src: '/tech-icons/php.svg' },
  vite:       { label: 'Vite',       src: '/tech-icons/vite.svg' },
  flutter:    { label: 'Flutter',    src: '/tech-icons/flutter.svg' },
  laravel:    { label: 'Laravel',    src: '/tech-icons/laravel.svg' },
  springboot: { label: 'Spring Boot', src: '/tech-icons/spring-boot-icon.svg' },
  postgresql: { label: 'PostgreSQL', src: '/tech-icons/postgresql-icon.svg' },
  cloudflare: { label: 'Cloudflare', src: '/tech-icons/cloudflare.svg' },
  nextjs:     { label: 'Next.js',    src: '/tech-icons/nextjs.svg' },
  vue:        { label: 'Vue',        src: '/tech-icons/vue.svg' },
  mysql:      { label: 'MySQL',      src: '/tech-icons/mysql.svg' },
  mongodb:    { label: 'MongoDB',    src: '/tech-icons/mongodb.svg' },
  redis:      { label: 'Redis',      src: '/tech-icons/redis.svg' },
  docker:     { label: 'Docker',     src: '/tech-icons/docker.svg' },
  python:     { label: 'Python',     src: '/tech-icons/python.svg' },
  django:     { label: 'Django',     src: '/tech-icons/django.svg' },
  go:         { label: 'Go',         src: '/tech-icons/go.svg' },
}

export type { TechKey }
