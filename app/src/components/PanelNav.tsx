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

  const mainItems = MODULE_NAV_ITEMS;
  const secondaryItems = [...(isAdmin ? [ADMIN_NAV_ITEM] : []), PROFILE_NAV_ITEM];

  if (direction === "horizontal") {
    return (
      <div className="flex gap-1">
        {[...mainItems, ...secondaryItems].map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-accent/10 text-accent"
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

  const railButtonClass = (isActive: boolean) =>
    `flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] transition-colors duration-200 ${
      isActive ? "bg-accent/10 text-accent" : "text-subtle hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {mainItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={railButtonClass(isActive)}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
          </Link>
        );
      })}
      <div className="my-1.5 h-px w-8 bg-border" />
      {secondaryItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={railButtonClass(isActive)}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}
