async function savePersonal(e) {
    e.preventDefault();
    if (!isEditing) return;

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const emergencyName = document.getElementById('emergencyName').value.trim();
    const emergencyPhone = document.getElementById('emergencyPhone').value.trim();

    const btn = document.getElementById('savePersonalBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch('/api/driver/profile', {   // ← FIXED endpoint
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, address, emergencyName, emergencyPhone }),
        });

        const data = await res.json().catch(() => ({}));

        // ✅ Actually check for errors
        if (!res.ok) throw new Error(data.message || 'Save failed');

        // Update local profile only on real success
        profile.phone = phone;
        profile.address = address;
        profile.emergencyName = emergencyName;
        profile.emergencyPhone = emergencyPhone;

        user.phone = phone;
        user.address = address;

        toggleEdit();
        showToast('success', 'Profile updated', 'Your changes have been saved');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}