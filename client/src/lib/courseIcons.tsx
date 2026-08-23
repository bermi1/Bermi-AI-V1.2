// Course/program/resource covers are a professional icon, not an emoji.
// `Course.cover_emoji` stores a kebab-case key from this set (the field name
// is unchanged from when it held literal emoji, to avoid a schema
// migration) — CourseIcon looks it up and falls back to a sane default for
// anything unrecognized, including any emoji still stored from before this
// change.
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  Code,
  Compass,
  Database,
  FileText,
  FlaskConical,
  Gem,
  Globe,
  GraduationCap,
  Handshake,
  HeartPulse,
  Landmark,
  Leaf,
  Lightbulb,
  Map,
  Megaphone,
  Palette,
  Rocket,
  Scale,
  Shield,
  Sprout,
  Target,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  'flask-conical': FlaskConical,
  code: Code,
  globe: Globe,
  'chart-bar': BarChart3,
  shield: Shield,
  leaf: Leaf,
  landmark: Landmark,
  'heart-pulse': HeartPulse,
  megaphone: Megaphone,
  scale: Scale,
  rocket: Rocket,
  palette: Palette,
  calculator: Calculator,
  database: Database,
  wrench: Wrench,
  briefcase: Briefcase,
  users: Users,
  lightbulb: Lightbulb,
  target: Target,
  compass: Compass,
  map: Map,
  gem: Gem,
  'trending-up': TrendingUp,
  'building-2': Building2,
  handshake: Handshake,
  brain: Brain,
  sprout: Sprout,
  'file-text': FileText,
}

export const COURSE_ICON_KEYS = Object.keys(ICONS)

export function CourseIcon({
  name,
  size = 20,
  className,
}: {
  name?: string | null
  size?: number
  className?: string
}) {
  const Icon = (name && ICONS[name]) || BookOpen
  return <Icon size={size} className={className} />
}
