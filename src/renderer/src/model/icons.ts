// Pictogrammes de la bibliothèque : tracés des icônes lucide (licence ISC, lucide.dev).
// Chaque icône est dessinée au trait sur une grille de 24 × 24.
import { __iconData as i_mouse_pointer_2 } from 'lucide-react/dist/esm/icons/mouse-pointer-2.mjs'
import { __iconData as i_mouse_pointer_click } from 'lucide-react/dist/esm/icons/mouse-pointer-click.mjs'
import { __iconData as i_pointer } from 'lucide-react/dist/esm/icons/pointer.mjs'
import { __iconData as i_keyboard } from 'lucide-react/dist/esm/icons/keyboard.mjs'
import { __iconData as i_check } from 'lucide-react/dist/esm/icons/check.mjs'
import { __iconData as i_circle_check } from 'lucide-react/dist/esm/icons/circle-check.mjs'
import { __iconData as i_x } from 'lucide-react/dist/esm/icons/x.mjs'
import { __iconData as i_circle_x } from 'lucide-react/dist/esm/icons/circle-x.mjs'
import { __iconData as i_circle_alert } from 'lucide-react/dist/esm/icons/circle-alert.mjs'
import { __iconData as i_triangle_alert } from 'lucide-react/dist/esm/icons/triangle-alert.mjs'
import { __iconData as i_info } from 'lucide-react/dist/esm/icons/info.mjs'
import { __iconData as i_lightbulb } from 'lucide-react/dist/esm/icons/lightbulb.mjs'
import { __iconData as i_star } from 'lucide-react/dist/esm/icons/star.mjs'
import { __iconData as i_heart } from 'lucide-react/dist/esm/icons/heart.mjs'
import { __iconData as i_thumbs_up } from 'lucide-react/dist/esm/icons/thumbs-up.mjs'
import { __iconData as i_sparkles } from 'lucide-react/dist/esm/icons/sparkles.mjs'
import { __iconData as i_bell } from 'lucide-react/dist/esm/icons/bell.mjs'
import { __iconData as i_message_circle } from 'lucide-react/dist/esm/icons/message-circle.mjs'
import { __iconData as i_mail } from 'lucide-react/dist/esm/icons/mail.mjs'
import { __iconData as i_flame } from 'lucide-react/dist/esm/icons/flame.mjs'
import { __iconData as i_play } from 'lucide-react/dist/esm/icons/play.mjs'
import { __iconData as i_download } from 'lucide-react/dist/esm/icons/download.mjs'
import { __iconData as i_upload } from 'lucide-react/dist/esm/icons/upload.mjs'
import { __iconData as i_settings } from 'lucide-react/dist/esm/icons/settings.mjs'
import { __iconData as i_search } from 'lucide-react/dist/esm/icons/search.mjs'
import { __iconData as i_lock } from 'lucide-react/dist/esm/icons/lock.mjs'
import { __iconData as i_user } from 'lucide-react/dist/esm/icons/user.mjs'
import { __iconData as i_users } from 'lucide-react/dist/esm/icons/users.mjs'
import { __iconData as i_folder } from 'lucide-react/dist/esm/icons/folder.mjs'
import { __iconData as i_file } from 'lucide-react/dist/esm/icons/file.mjs'
import { __iconData as i_code } from 'lucide-react/dist/esm/icons/code.mjs'
import { __iconData as i_terminal } from 'lucide-react/dist/esm/icons/terminal.mjs'
import { __iconData as i_monitor } from 'lucide-react/dist/esm/icons/monitor.mjs'
import { __iconData as i_laptop } from 'lucide-react/dist/esm/icons/laptop.mjs'
import { __iconData as i_smartphone } from 'lucide-react/dist/esm/icons/smartphone.mjs'
import { __iconData as i_cloud } from 'lucide-react/dist/esm/icons/cloud.mjs'
import { __iconData as i_wifi } from 'lucide-react/dist/esm/icons/wifi.mjs'
import { __iconData as i_zap } from 'lucide-react/dist/esm/icons/zap.mjs'
import { __iconData as i_rocket } from 'lucide-react/dist/esm/icons/rocket.mjs'
import { __iconData as i_gift } from 'lucide-react/dist/esm/icons/gift.mjs'
import { __iconData as i_trophy } from 'lucide-react/dist/esm/icons/trophy.mjs'
import { __iconData as i_clock } from 'lucide-react/dist/esm/icons/clock.mjs'
import { __iconData as i_calendar } from 'lucide-react/dist/esm/icons/calendar.mjs'
import { __iconData as i_map_pin } from 'lucide-react/dist/esm/icons/map-pin.mjs'
import { __iconData as i_camera } from 'lucide-react/dist/esm/icons/camera.mjs'
import { __iconData as i_video } from 'lucide-react/dist/esm/icons/video.mjs'
import { __iconData as i_mic } from 'lucide-react/dist/esm/icons/mic.mjs'
import { __iconData as i_volume_2 } from 'lucide-react/dist/esm/icons/volume-2.mjs'
import { __iconData as i_arrow_big_down } from 'lucide-react/dist/esm/icons/arrow-big-down.mjs'

export type IconNode = [string, Record<string, string>][]

export interface IconDef {
  id: string
  label: string
  node: IconNode
}

export const ICONS: IconDef[] = [
  { id: 'mouse-pointer-2', label: 'Curseur', node: i_mouse_pointer_2.node },
  { id: 'mouse-pointer-click', label: 'Clic', node: i_mouse_pointer_click.node },
  { id: 'pointer', label: 'Main', node: i_pointer.node },
  { id: 'keyboard', label: 'Clavier', node: i_keyboard.node },
  { id: 'check', label: 'Coche', node: i_check.node },
  { id: 'circle-check', label: 'Validé', node: i_circle_check.node },
  { id: 'x', label: 'Croix', node: i_x.node },
  { id: 'circle-x', label: 'Refusé', node: i_circle_x.node },
  { id: 'circle-alert', label: 'Attention', node: i_circle_alert.node },
  { id: 'triangle-alert', label: 'Danger', node: i_triangle_alert.node },
  { id: 'info', label: 'Info', node: i_info.node },
  { id: 'lightbulb', label: 'Idée', node: i_lightbulb.node },
  { id: 'star', label: 'Étoile', node: i_star.node },
  { id: 'heart', label: 'Cœur', node: i_heart.node },
  { id: 'thumbs-up', label: 'J’aime', node: i_thumbs_up.node },
  { id: 'sparkles', label: 'Étincelles', node: i_sparkles.node },
  { id: 'bell', label: 'Cloche', node: i_bell.node },
  { id: 'message-circle', label: 'Message', node: i_message_circle.node },
  { id: 'mail', label: 'E-mail', node: i_mail.node },
  { id: 'flame', label: 'Tendance', node: i_flame.node },
  { id: 'play', label: 'Lecture', node: i_play.node },
  { id: 'download', label: 'Télécharger', node: i_download.node },
  { id: 'upload', label: 'Envoyer', node: i_upload.node },
  { id: 'settings', label: 'Réglages', node: i_settings.node },
  { id: 'search', label: 'Recherche', node: i_search.node },
  { id: 'lock', label: 'Cadenas', node: i_lock.node },
  { id: 'user', label: 'Personne', node: i_user.node },
  { id: 'users', label: 'Équipe', node: i_users.node },
  { id: 'folder', label: 'Dossier', node: i_folder.node },
  { id: 'file', label: 'Fichier', node: i_file.node },
  { id: 'code', label: 'Code', node: i_code.node },
  { id: 'terminal', label: 'Terminal', node: i_terminal.node },
  { id: 'monitor', label: 'Écran', node: i_monitor.node },
  { id: 'laptop', label: 'Ordinateur', node: i_laptop.node },
  { id: 'smartphone', label: 'Mobile', node: i_smartphone.node },
  { id: 'cloud', label: 'Nuage', node: i_cloud.node },
  { id: 'wifi', label: 'Wi-Fi', node: i_wifi.node },
  { id: 'zap', label: 'Éclair', node: i_zap.node },
  { id: 'rocket', label: 'Fusée', node: i_rocket.node },
  { id: 'gift', label: 'Cadeau', node: i_gift.node },
  { id: 'trophy', label: 'Trophée', node: i_trophy.node },
  { id: 'clock', label: 'Horloge', node: i_clock.node },
  { id: 'calendar', label: 'Agenda', node: i_calendar.node },
  { id: 'map-pin', label: 'Lieu', node: i_map_pin.node },
  { id: 'camera', label: 'Photo', node: i_camera.node },
  { id: 'video', label: 'Vidéo', node: i_video.node },
  { id: 'mic', label: 'Micro', node: i_mic.node },
  { id: 'volume-2', label: 'Son', node: i_volume_2.node },
  { id: 'arrow-big-down', label: 'Grosse flèche', node: i_arrow_big_down.node },
]

export function findIcon(id: string): IconDef | undefined {
  return ICONS.find((i) => i.id === id)
}
