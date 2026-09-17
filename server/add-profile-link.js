import fs from 'fs';
import path from 'path';

const files = [
    'client/admin/dashboard.html',
    'client/admin/buses.html',
    'client/admin/routes.html',
    'client/admin/drivers.html',
    'client/admin/schedules.html',
    'client/admin/live-buses.html',
    'client/admin/reports.html',
    'client/admin/users.html',
];

const profileLink = '        <a href="/admin/profile.html" class="nav-item"><i class="fas fa-user"></i><span>Profile</span></a>';

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) {
            console.log('⚠️  Missing:', file);
            return;
        }

        let html = fs.readFileSync(file, 'utf8');

        // Skip if already has profile link
        if (html.includes('/admin/profile.html" class="nav-item"')) {
            console.log('⏭️  Already has profile link:', file);
            return;
        }

        // Find the Users nav link (or admin/dashboard line) and add profile after it
        // Pattern: any line containing nav-item with users or any last nav-item before </nav>

        // Try to insert after the Users link
        const usersLinkRegex = /(<a href="\/admin\/users\.html"[^>]*class="nav-item"[^>]*>[\s\S]*?<\/a>)/;
        if (usersLinkRegex.test(html)) {
            html = html.replace(usersLinkRegex, `$1\n${profileLink}`);
            fs.writeFileSync(file, html);
            console.log('✅ Added profile link to:', file);
            return;
        }

        // Fallback: insert before </nav>
        const navCloseRegex = /(\s*<\/nav>)/;
        if (navCloseRegex.test(html)) {
            html = html.replace(navCloseRegex, `\n${profileLink}\n$1`);
            fs.writeFileSync(file, html);
            console.log('✅ Added profile link (fallback) to:', file);
            return;
        }

        console.log('❌ Could not find insert point in:', file);
    } catch (err) {
        console.error('❌ Error with', file, ':', err.message);
    }
});

console.log('\nDone.');
