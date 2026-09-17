import type { MetadataRoute } from 'next'

export default function manifest():MetadataRoute.Manifest{
  return {
    id:'/',
    name:'LUXE On Demand',
    short_name:'LUXE',
    description:'Premium black-car, SUV, airport and executive transportation from the verified LUXE driver network.',
    start_url:'/?source=pwa',
    scope:'/',
    display:'standalone',
    display_override:['window-controls-overlay','standalone'],
    orientation:'portrait-primary',
    background_color:'#080b10',
    theme_color:'#080b10',
    categories:['travel','transportation','business'],
    prefer_related_applications:false,
    icons:[
      {src:'/api/pwa-icon?size=192',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/api/pwa-icon?size=512',sizes:'512x512',type:'image/png',purpose:'any'},
      {src:'/api/pwa-icon?size=512',sizes:'512x512',type:'image/png',purpose:'maskable'},
    ],
  }
}
