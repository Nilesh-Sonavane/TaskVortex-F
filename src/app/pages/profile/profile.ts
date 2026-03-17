import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {

  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  isEditing = signal(false);
  isLoading = signal(false);

  user = signal({
    id: 0,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    department: '',
    jobTitle: '',
    role: '',
    location: '',
    active: true,
    profileUrl: null as string | null
  });

  // --- NEW: Draft data to stop live banner updates ---
  editData = {
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    location: ''
  };

  passwordData = { current: '', new: '', confirm: '' };

  initials = computed(() => {
    const f = this.user().firstName;
    const l = this.user().lastName;
    return f && l ? `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() : 'U';
  });

  ngOnInit() {
    this.loadUserData();
  }

  loadUserData() {
    this.userService.getMyProfile().subscribe({
      next: (data: any) => {
        this.user.set(data);

        // Fill the draft data when page loads
        this.editData = {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          bio: data.bio || '',
          location: data.location || ''
        };
      },
      error: (err) => {
        this.toastService.show('Failed to load user profile.', 'error');
      }
    });
  }

  getAvatar(): string {
    const currentUrl = this.user().profileUrl;
    if (currentUrl) {
      return currentUrl.startsWith('http') ? currentUrl : `http://localhost:8080${currentUrl}`;
    }
    return `https://ui-avatars.com/api/?name=${this.initials()}&background=818cf8&color=fff&size=150&bold=true`;
  }

  getDepartmentName(): string {
    const dept = this.user().department;
    return dept ? dept : 'Unassigned';
  }

  toggleEdit() {
    // Reset the draft data if they cancel
    this.editData = {
      firstName: this.user().firstName,
      lastName: this.user().lastName,
      phone: this.user().phone,
      bio: this.user().bio,
      location: this.user().location
    };
    this.isEditing.update(v => !v);
  }

  editAvatar() { document.getElementById('avatarUpload')?.click(); }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => this.user.update(u => ({ ...u, profileUrl: e.target.result }));
      reader.readAsDataURL(file);

      this.userService.uploadProfileImage(file).subscribe({
        next: (response) => {
          this.user.update(u => ({ ...u, profileUrl: response.profileUrl }));
          this.authService.updateCurrentUser({ profileUrl: response.profileUrl });
          this.toastService.show('Profile picture updated successfully!', 'success');
        },
        error: (err) => {
          this.toastService.show('Failed to upload image. Please try again.', 'error');
        }
      });
    }
  }

  saveProfile() {
    // --- READ FROM DRAFT DATA INSTEAD OF USER() ---
    const { firstName, lastName, phone, location, bio } = this.editData;

    if (!firstName || firstName.trim().length < 2) {
      this.toastService.show('First name must be at least 2 characters.', 'error');
      return;
    }

    if (!lastName || lastName.trim().length < 2) {
      this.toastService.show('Last name must be at least 2 characters.', 'error');
      return;
    }

    const phoneRegex = /^(\+?[0-9\s\-]{7,15})?$/;
    if (phone && !phoneRegex.test(phone.trim())) {
      this.toastService.show('Please enter a valid phone number.', 'error');
      return;
    }

    if (location && location.length > 100) {
      this.toastService.show('Location is too long (maximum 100 characters).', 'error');
      return;
    }

    if (bio && bio.length > 500) {
      this.toastService.show('About Me is too long (maximum 500 characters).', 'error');
      return;
    }

    this.isLoading.set(true);

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone ? phone.trim() : '',
      bio: bio ? bio.trim() : '',
      location: location ? location.trim() : ''
    };

    this.userService.updateMyProfile(payload).subscribe({
      next: (updatedUser) => {
        this.isLoading.set(false);
        this.isEditing.set(false);

        // --- OFFICIALLY UPDATE THE BANNER ---
        this.user.update(u => ({ ...u, ...payload }));

        // Sync Navbar instantly
        this.authService.updateCurrentUser(payload);

        this.toastService.show('Profile changes saved successfully!', 'success');
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 400) {
          this.toastService.show('Please check your input fields for errors.', 'error');
        } else {
          this.toastService.show('Could not save profile changes.', 'error');
        }
      }
    });
  }

  changePassword() {
    if (!this.passwordData.current) {
      this.toastService.show('Please enter your current password.', 'error');
      return;
    }

    if (!this.passwordData.new || this.passwordData.new !== this.passwordData.confirm) {
      this.toastService.show('New passwords do not match.', 'error');
      return;
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!]).{8,}$/;
    if (!passwordRegex.test(this.passwordData.new)) {
      this.toastService.show('Password must be 8+ chars with an uppercase, number, and special character.', 'error');
      return;
    }

    const payload = {
      currentPassword: this.passwordData.current,
      newPassword: this.passwordData.new
    };

    this.userService.changePassword(payload).subscribe({
      next: () => {
        this.toastService.show('Security keys updated successfully!', 'success');
        this.passwordData = { current: '', new: '', confirm: '' };
      },
      error: (err) => {
        if (err.status === 400) {
          this.toastService.show('Incorrect current password.', 'error');
        } else {
          this.toastService.show('Failed to change password. Please try again.', 'error');
        }
      }
    });
  }
}