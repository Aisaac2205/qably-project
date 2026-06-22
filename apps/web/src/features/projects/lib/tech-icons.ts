export const TECH_ICONS = {
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
} as const

export type TechKey = keyof typeof TECH_ICONS
