"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LinkIcon,
  ChatBubbleLeftRightIcon,
  InboxIcon,
  ChartBarIcon,
  PhotoIcon,
  UsersIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

const MODULE_NAV_ITEMS = [
  { href: "/panel/connections", label: "Подключения", icon: LinkIcon },
  { href: "/panel/scenarios", label: "Сценарии", icon: ChatBubbleLeftRightIcon },
  { href: "/panel/inbox", label: "Инбокс", icon: InboxIcon },
  { href: "/panel/analytics", label: "Аналитика", icon: ChartBarIcon },
  { href: "/panel/content", label: "Контент", icon: PhotoIcon },
];

const ADMIN_NAV_ITEM = { href: "/panel/users", label: "Пользователи", icon: UsersIcon };
const PROFILE_NAV_ITEM = { href: "/panel/profile", label: "Профиль", icon: UserCircleIcon };

export function PanelNav({
  direction = "vertical",
  isAdmin = false,
}: {
  direction?: "vertical" | "horizontal";
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  const items = [
    ...MODULE_NAV_ITEMS,
    ...(isAdmin ? [ADMIN_NAV_ITEM] : []),
    PROFILE_NAV_ITEM,
  ];

  return (
    <div className={direction === "vertical" ? "flex flex-col gap-1" : "flex gap-1"}>
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-sm px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
