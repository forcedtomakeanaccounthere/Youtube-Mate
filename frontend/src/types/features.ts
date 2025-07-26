export interface Feature {
  route: string
  id: string
  title: string
  image: string
  icon: string
  description: string
  content: {
    title: string
    description: string
    features: string[]
  }
}