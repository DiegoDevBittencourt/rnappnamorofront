import Geolocation from 'react-native-geolocation-service';
import { Keyboard } from 'react-native';
import firebase from 'firebase';
import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import Geocoder from 'react-native-geocoding';
import * as RootNavigationRef from '../routes/RootNavigationRef';

import { REACT_APP_GEOCODE_API_KEY } from 'react-native-expand-dotenv';
import * as Types from '../constants/Types';
import * as Options from '../components/utils/Options';
import {
    handleError,
    calculateDistanceFromLatLonInKm,
    calculateAge,
    convertDateFormatToHHMM,
    decodeJwtToken
} from '../components/utils/Functions';
import { successNotification } from '../components/utils/Notifications';
import { Api } from '../components/utils/Api';

Geocoder.init(REACT_APP_GEOCODE_API_KEY, { language: 'pt-br' });

const unsubscribeFirebaseListeners = [];

export function setAccessTokenOnStorageAndRedux(accessToken) {
    return async dispatch => {
        AsyncStorage.setItem('accessToken', accessToken || '');
        dispatch(updateAccessTokenOnRedux(accessToken));
    }
}

export function updateAccessTokenOnRedux(accessToken) {
    return {
        type: Types.UPDATE_ACCESS_TOKEN,
        accessToken
    }
}

export function checkIfTokenHasExpired() {
    return async (dispatch, getState) => {
        try {

            dispatch(isCheckingIfTokenHasExpiredStatus(true));

            const accessToken = getState().auth.accessToken;

            if (accessToken) {

                await Api({ accessToken }).post('account/check_if_token_has_expired', { /*body*/ });

                dispatch({
                    type: Types.CHECK_IF_TOKEN_HAS_EXPIRED,
                    isAuthenticated: true
                });

                dispatch(isCheckingIfTokenHasExpiredStatus(false));

                dispatch(getUserData(true, true, true, true));

            } else {

                dispatch(isCheckingIfTokenHasExpiredStatus(false));
                dispatch(signOut());
            }

        } catch (err) {

            dispatch(isCheckingIfTokenHasExpiredStatus(false));
            dispatch(handleActionError(err));
        }
    }
}

export function isCheckingIfTokenHasExpiredStatus(isCheckingIfTokenHasExpired) {
    return {
        type: Types.CHECKING_IF_TOKEN_HAS_EXPIRED,
        isCheckingIfTokenHasExpired
    }
}

export function getAddress() {
    return async dispatch => {

        const handleGeolocationError = (error) => {

            dispatch(updateIsGettingLocation(false));

            dispatch({
                type: Types.IS_GEOLOCATION_ENABLE,
                isGeolocationEnabled: false
            })

            RootNavigationRef.push('TurnOnLocationModal');

            dispatch(handleActionError(error));
        }

        dispatch(updateIsGettingLocation(true));

        await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: "Libere o acesso a sua localização!",
                message: 'O App Namoro precisa acessar sua localização para encontrar pessoas próximas.',
                buttonNeutral: "Perguntar depois",
                buttonNegative: "Cancelar",
                buttonPositive: "OK"
            }
        );

        Geolocation.getCurrentPosition(
            (position) => {

                let lat = position?.coords?.latitude;
                let lng = position?.coords?.longitude;

                Geocoder.from({ lat, lng }).then(json => {

                    const address = json.results[6].formatted_address;

                    dispatch({
                        type: Types.IS_GEOLOCATION_ENABLE,
                        isGeolocationEnabled: true
                    })

                    dispatch(updateUserDataOnRedux({
                        address,
                        currentLongitude: lng,
                        currentLatitude: lat
                    }));

                    dispatch(updateUser({
                        lastLongitude: lng,
                        lastLatitude: lat
                    }));

                    dispatch(updateIsGettingLocation(false));

                    dispatch(getNextProfileForTheMatchSearcher());

                }).catch(error => handleGeolocationError(error));
            },
            (error) => {
                handleGeolocationError(error);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        )
    }
}

export function updateIsGettingLocation(isGettingLocation) {
    return {
        type: Types.IS_GETTING_LOCATION,
        isGettingLocation
    }
}

export function updateFirebaseUidOnRedux(firebaseUid) {
    return {
        type: Types.UPDATE_FIREBASE_UID,
        firebaseUid
    }
}

export function signInOrSignUpToFirebase() {//if there's no record try sign in, otherwise: sign up
    return async (dispatch, getState) => {

        const userEmail = getState().dashboard.userData.email;

        const addUserOnFirestore = async (user) => {
            try {
                const db = firebase.firestore();

                await db.collection('users')
                    .doc(user.uid)
                    .set({
                        mySqlUserId: userEmail,
                        uid: user.uid,//generated by firebase
                        isOnline: true,
                        createdAt: new Date()
                    });

                dispatch(updateFirebaseUidOnRedux(user.uid));
            } catch (err) {
                dispatch(handleActionError(err));
            };
        }

        firebase.auth().signInWithEmailAndPassword(userEmail, userEmail).then(user => {

            dispatch(updateFirebaseUidOnRedux(user.user.uid));
            dispatch(getRealtimeMessagesFromFirebase());

            dispatch({
                type: Types.UPDATE_FIREBASE_USER,
                firebaseUser: { uid: user.user.uid }
            });

        }).catch(err => {

            if (err.code === 'auth/user-not-found') {

                firebase.auth().createUserWithEmailAndPassword(userEmail, userEmail).then(user => {

                    addUserOnFirestore({ uid: user.user.uid });

                    dispatch({
                        type: Types.UPDATE_FIREBASE_USER,
                        firebaseUser: { uid: user.user.uid }
                    });

                }).catch(err => {
                    dispatch(handleActionError(err));
                })
            }
            else {
                dispatch(handleActionError(err));
            }
        })
    }
}

export function getRealtimeMessagesFromFirebase() {
    return (dispatch, getState) => {

        const { id: userId } = getState().dashboard.userData;

        const db = firebase.firestore();

        var realTimeFirebaseChat1 = [];
        var realTimeFirebaseChat2 = [];
        var realTimeFirebaseChatFinal = [];
        //I'm using this ^ two helper arrays cause firestore doesn't accept OR operator

        unsubscribeFirebaseListeners.push(
            db.collection('chat')
                .where('userId_1', '==', userId)
                .orderBy('createdAt', 'asc')
                .onSnapshot(async (querySnapshot) => {

                    realTimeFirebaseChat1 = [];

                    querySnapshot.forEach(doc => {
                        realTimeFirebaseChat1.push(doc.data());
                    });

                    unsubscribeFirebaseListeners.push(db.collection('chat')
                        .where('userId_2', '==', userId)
                        .orderBy('createdAt', 'asc')
                        .onSnapshot(async (querySnapshot) => {

                            realTimeFirebaseChat2 = [];

                            querySnapshot.forEach(doc => {
                                realTimeFirebaseChat2.push(doc.data());
                            });

                            realTimeFirebaseChatFinal = [];

                            realTimeFirebaseChatFinal = realTimeFirebaseChat1.concat(realTimeFirebaseChat2)
                                .sort((a, b) => b.createdAt - a.createdAt)//order all messages desc by date

                            realTimeFirebaseChatFinal = realTimeFirebaseChatFinal.map(item => ({
                                ...item,
                                hourMinute: convertDateFormatToHHMM(item.createdAt.toDate())
                            }));

                            realTimeFirebaseChatFinal = realTimeFirebaseChatFinal.map((item, index) =>
                                ({ ...item, id: (item.createdAt.nanoseconds + item.createdAt.seconds + index).toString() })
                            );

                            dispatch({
                                type: Types.UPDATE_REAL_TIME_FIREBASE_CHAT,
                                realTimeFirebaseChat: realTimeFirebaseChatFinal
                            });
                        })
                    );
                })
        );
    }
}

export function sendMessageToFirebase(message, matchedProfileId) {
    return async (dispatch, getState) => {

        const db = firebase.firestore();

        await db.collection('chat')
            .add({
                userId_1: getState().dashboard.userData.id,
                userId_2: matchedProfileId,
                createdAt: new Date(),
                isView: false,
                message
            })
            .catch(err => {
                dispatch(handleActionError(err));
            });
    }
}

export function signOut() {
    return async (dispatch) => {
        try {
            unsubscribeFirebaseListeners.map(item => item());

            await AsyncStorage.setItem('accessToken', '');

            firebase.auth().signOut();

            dispatch(cleanMatchSearcherArrayAndGetNextProfile(false));
            dispatch(updateMatchedProfilesArray([]));

            dispatch(setAccessTokenOnStorageAndRedux(''));
            dispatch(signOutAction());

            dispatch(showLoader(false));

            RootNavigationRef.reset('Home');

        } catch (err) {

            dispatch(handleActionError(err));
            dispatch(setAccessTokenOnStorageAndRedux(''));
        }
    }
}

export function signOutAction() {
    return { type: Types.AUTH_SIGN_OUT };
}

export function getMatchedProfiles() {
    return async (dispatch, getState) => {
        //get only profiles that was already matched with current user

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {
            const res = await Api({ accessToken: authState.accessToken }).get(
                `users/get_match_profiles/${dashboardState.userData.id}`
                , {});

            res.data.map(item => {
                item.age = calculateAge(new Date(item.birthday))
                item.distance = parseInt(calculateDistanceFromLatLonInKm(
                    dashboardState.userData.currentLongitude,
                    dashboardState.userData.currentLatitude,
                    item.lastLongitude,
                    item.lastLatitude
                ))
            });

            dispatch(updateMatchedProfilesArray(res.data));

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function updateMatchedProfilesArray(matchedProfiles) {
    return {
        type: Types.UPDATE_MATCHED_PROFILES_ARRAY,
        matchedProfiles
    }
}

export function updateIsGettingProfileForTheMatchSearcher(isGettingProfileForTheMatchSearcher) {
    return {
        type: Types.IS_GETTING_PROFILE_FOR_THE_MATCH_SEARCHER,
        isGettingProfileForTheMatchSearcher
    }
}

export function updateProfileIdsAlreadyDownloaded(userId) {
    return {
        type: Types.UPDATE_PROFILE_IDS_ALREADY_DOWNLOADED,
        userId
    };
}

export function addProfileIntoMatchSearcherArray(profile) {
    return {
        type: Types.ADD_PROFILE_TO_THE_MATCH_SEARCHER_ARRAY,
        profile
    };
}

export function updateUser(user, shouldShowLoader, CleanMatchSearcherArrayAndGetNextProfile) {
    return async (dispatch, getState) => {

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {

            shouldShowLoader && dispatch(showLoader(true));

            user = { ...user, id: dashboardState.userData.id };

            await Api({ accessToken: authState.accessToken }).post(`users/update_user`, { user });

            CleanMatchSearcherArrayAndGetNextProfile ?
                dispatch(cleanMatchSearcherArrayAndGetNextProfile(true))
                : dispatch(getUserData());

            dispatch(showLoader(false));

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function cleanMatchSearcherArrayAndGetNextProfile(shouldGetUserData) {
    return dispatch => {
        dispatch(removeAllIdsFromProfileIdsAlreadyDownloaded());
        dispatch(removeUserFromMatchSearcher(null, true));

        shouldGetUserData && dispatch(getUserData(true, true));
    }
}

export function getNextProfileForTheMatchSearcher() {
    return async (dispatch, getState) => {

        const {
            userData,
            profileIdsAlreadyDownloaded,
            matchSearcherProfiles,
            isGettingProfileForTheMatchSearcher
        } = getState().dashboard;
        const { accessToken } = getState().auth;
        const { isGeolocationEnabled } = getState().utils;

        try {
            if (!isGettingProfileForTheMatchSearcher && matchSearcherProfiles.length < 2 && isGeolocationEnabled) {

                dispatch(updateIsGettingProfileForTheMatchSearcher(true));

                const res = await Api({ accessToken }).post('users/get_profile_to_the_match_searcher', {
                    currentLongitude: userData.currentLongitude,
                    currentLatitude: userData.currentLatitude,
                    maxDistance: userData.maxDistance,
                    userId: userData.id,
                    searchingBy: userData.searchingBy.key,
                    profileIdsAlreadyDownloaded: profileIdsAlreadyDownloaded,
                    ageRange: userData.ageRange
                });

                if (res.data.user) {
                    res.data.user.distance = parseInt(calculateDistanceFromLatLonInKm(
                        userData.currentLongitude,
                        userData.currentLatitude,
                        res.data.user.lastLongitude,
                        res.data.user.lastLatitude
                    ));

                    res.data.user.age = calculateAge(new Date(res.data.user.birthday));

                    dispatch(addProfileIntoMatchSearcherArray(res.data.user));

                    dispatch(updateProfileIdsAlreadyDownloaded(res.data.user.id));

                    dispatch(updateIsGettingProfileForTheMatchSearcher(false));

                    /*matchSearcherProfiles must have at least 2 profiles, so when user likes/ignores the first one,
                    the second will appear*/
                    matchSearcherProfiles.length < 2 && dispatch(getNextProfileForTheMatchSearcher());
                }
                else
                    dispatch(updateIsGettingProfileForTheMatchSearcher(false));
            }
            else
                dispatch(updateIsGettingProfileForTheMatchSearcher(false));

        } catch (err) {
            dispatch(updateIsGettingProfileForTheMatchSearcher(false));
            dispatch(handleActionError(err));
        }
    }
}

export function removeAllIdsFromProfileIdsAlreadyDownloaded() {
    return {
        type: Types.REMOVE_ALL_IDS_FROM_PROFILE_IDS_ALREADY_DOWNLOADED
    }
}

export function ignoreCurrentProfile(profile) {
    return dispatch => {
        dispatch(removeUserFromMatchSearcher(profile.id));
        dispatch(getNextProfileForTheMatchSearcher());
    }
}

export function likeCurrentProfile(profile, superLike) {
    return dispatch => {
        dispatch(createOrUpdateMatchedProfile(profile, superLike));
        dispatch(removeUserFromMatchSearcher(profile.id));
        dispatch(getNextProfileForTheMatchSearcher());
    }
}

export function createOrUpdateMatchedProfile(profile, superLike) {
    return async (dispatch, getState) => {

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {
            const res = await Api({ accessToken: authState.accessToken }).post('users/create_or_update_user_match', {
                userId: dashboardState.userData.id,
                profileId: profile.id,
                superLike
            });

            if (res.data === 'you have a match!') {

                dispatch(getMatchedProfiles());
                dispatch(openYouHaveAMatchModal(true));
            }

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function openYouHaveAMatchModal(open) {
    return {
        type: Types.OPEN_YOU_HAVE_A_MATCH_MODAL,
        isYouHaveAMatchModalOpen: open,
    }
}

export function removeUserFromMatchSearcher(userId, removeAll) {
    return ({
        type: Types.REMOVE_USER_FROM_THE_MATCH_SEARCHER_ARRAY,
        userId,
        removeAll
    });
}

export function getUserData(
    shouldGetAddress,
    shouldGetProfilesForMatchSearcher,
    shouldSignInOnFirebase,
    shouldGetMatchedProfiles
) {

    const populateSearchingByDesc = (userData) => {
        const searchingByOptions = Options.searchingByOptions();

        let index = 0;
        for (let i = 0; i <= searchingByOptions.length - 1; i++) {
            if (userData.searchingBy === searchingByOptions[i].key)
                index = i;
        }

        return userData.searchingByDesc = searchingByOptions[index].label;
    }

    const populateSchoolingDesc = (userData) => {
        const schoolingOptions = Options.schoolingOptions();

        let index = 0;
        for (let i = 0; i <= schoolingOptions.length - 1; i++) {
            if (userData.schooling === schoolingOptions[i].key)
                index = i;
        }

        return userData.schoolingDesc = schoolingOptions[index].label;
    }

    const populateGenderDesc = (userData) => {
        const genderOptions = Options.genderOptions();

        let index = 0;
        for (let i = 0; i <= genderOptions.length - 1; i++) {
            if (userData.gender === genderOptions[i].key)
                index = i;
        }

        return userData.genderDesc = genderOptions[index].label;
    }

    return async (dispatch, getState) => {

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {

            const res = await Api({ accessToken: authState.accessToken })
                .get(`users/get_user/${dashboardState.userData.id}`, {});

            const userData = res.data;

            populateSearchingByDesc(userData);
            populateSchoolingDesc(userData);
            populateGenderDesc(userData);

            //handling userData fields to be correctly "read" by the app
            const ageRange = userData.ageRange.split(',');
            userData.ageRange = ageRange.map(item => parseInt(item));
            userData.schooling = { key: userData.schooling, label: userData.schoolingDesc };
            userData.gender = { key: userData.gender, label: userData.genderDesc };
            userData.searchingBy = { key: userData.searchingBy, label: userData.searchingByDesc };
            userData.birthday = new Date(userData.birthday);//needed to work properly on datePicker
            userData.age = calculateAge(userData.birthday);
            userData.showMeOnApp = userData.showMeOnApp == 1;
            userData.emailNotification = userData.emailNotification == 1;
            userData.pushNotification = userData.pushNotification == 1;

            userData.userImages.map(item => {
                item.progress = 0;
                item.uploaded = true;
                item.error = false;
            });

            dispatch(updateUserDataOnRedux(userData));

            !userData.profileComplete && RootNavigationRef.push('CompleteYourProfileModal');

            shouldGetAddress && dispatch(getAddress());

            shouldSignInOnFirebase && dispatch(signInOrSignUpToFirebase());

            shouldGetMatchedProfiles && dispatch(getMatchedProfiles());

            shouldGetProfilesForMatchSearcher && dispatch(getNextProfileForTheMatchSearcher());

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function showProfileCardEditMode(isProfileCardEditModeOpen) {
    return {
        type: Types.PROFILE_CARD_EDIT_MODE,
        isProfileCardEditModeOpen
    };
}

export function uploadImageToServer(imageData, selectedFile) {
    return async (dispatch, getState) => {

        const { id: userId } = getState().dashboard.userData;
        const { accessToken } = getState().auth;

        try {

            await Api({ accessToken }).post(`users/user_images/${userId}`, imageData, {
                onUploadProgress: e => {

                    const progress = parseInt(Math.round((e.loaded * 100) / e.total));

                    dispatch(updateUploadingImagesPreview({ ...selectedFile, progress }));
                }
            });

            dispatch(updateUploadingImagesPreview(null, selectedFile.id));

            dispatch(getUserData(true));

        } catch (err) {

            dispatch(updateUploadingImagesPreview(null, selectedFile.id));
            dispatch(handleActionError(err));
        }
    }
}

export function sendNewUserContact(name, email, subject, message) {
    return async (dispatch, getState) => {

        const { accessToken } = getState().auth;

        try {

            dispatch(showLoader(true));

            await Api({ accessToken }).post('users/contact', { name, email, subject, message });

            dispatch(showLoader(false));

            successNotification('Contato enviado com sucesso! Obrigado por nos contactar.');

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function sendRecoverPasswordEmail(email) {
    return async (dispatch, getState) => {

        const { accessToken } = getState().auth;

        try {

            dispatch(showLoader(true));

            await Api({ accessToken }).post('account/send_recovery_password_email', { email });

            dispatch(showLoader(false));

            successNotification('E-mail enviado, verifique sua caixa de entrada.');

        } catch (err) {

            dispatch(Actions.showLoader(false));
            dispatch(handleActionError(err));
        }
    }
}

export function sendEmailVerification(email) {
    return async (dispatch, getState) => {

        const { accessToken } = getState().auth;

        try {

            dispatch(showLoader(true));

            const userId = decodeJwtToken(accessToken).id;

            await Api({ accessToken }).post('account/send_email_verification', { email, id: userId });

            dispatch(showLoader(false));

            successNotification('E-mail enviado, verifique sua caixa de entrada.');

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function updateVerifiedEmail(id, token, email) {
    return async (dispatch, getState) => {

        const { accessToken } = getState().auth;

        try {

            dispatch(showLoader(true));

            await Api({ accessToken }).post('account/update_verified_email', { email, token, id });

            dispatch(Actions.showLoader(false));

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function resetPassword(email, token, password, passwordConfirmation) {
    return async (dispatch, getState) => {

        const { accessToken } = getState().auth;

        try {

            dispatch(showLoader(true));

            const res = await Api({ accessToken }).post('account/passwordreset', { email, token, password, passwordConfirmation });

            dispatch(showLoader(false));

            return res;

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function updateUploadingImagesPreview(image, removeImageByThisId) {
    return {
        type: Types.UPLOADING_IMAGES,
        image,
        removeImageByThisId
    };
}

export function openCompleteYourProfileModal(isCompleteYourProfileModalOpen) {
    return {
        type: Types.OPEN_COMPLETE_YOUR_PROFILE_MODAL,
        isCompleteYourProfileModalOpen: isCompleteYourProfileModalOpen
    }
}

export function openChatPanel(isChatPanelOpen) {
    return {
        type: Types.OPEN_CHAT_PANEL,
        isChatPanelOpen
    }
}

export function openMobileEditInfo(isMobileEditInfoOpen) {
    return {
        type: Types.OPEN_MOBILE_EDIT_INFO,
        isMobileEditInfoOpen
    }
}

export function updateUserDataOnRedux(userData) {
    return {
        type: Types.UPDATE_USER_DATA,
        userData
    }
}

export function signUpAction(userData, navigation) {
    return async (dispatch, getState) => {

        try {

            dispatch(showLoader(true));

            const res = await Api({ accessToken: getState().auth.accessToken }).post('account/signup', userData);

            navigation.goBack();

            dispatch(setAccessTokenOnStorageAndRedux(res.data.token));

            dispatch({
                type: Types.AUTH_SIGN_UP,
            });

            dispatch(showLoader(false));

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function deleteUserImage(imageId) {
    return async (dispatch, getState) => {
        try {

            dispatch(showLoader(true));

            await Api({ accessToken: getState().auth.accessToken }).delete(`users/user_images/${imageId}`);

            dispatch(showLoader(false));
            dispatch(getUserData(true));

            RootNavigationRef.goBack();

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function unmatch(profileId) {
    return async (dispatch, getState) => {

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {

            dispatch(showLoader(true));

            await Api({ accessToken: authState.accessToken }).post(`users/unmatch`,
                { userId: dashboardState.userData.id, profileId }
            );

            await dispatch(removeAllConversationsFromThisMatch(profileId));

            dispatch(showLoader(false));

            dispatch(getUserData(true, true, false, true));

            RootNavigationRef.goBack();//hides yesNo modal
            RootNavigationRef.goBack();//hides chat screen modal

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function removeAllConversationsFromThisMatch(matchedProfileId) {
    return async (dispatch, getState) => {

        const loggedUserId = getState().dashboard.userData.id;

        try {
            const db = firebase.firestore();

            const conversation1 = db.collection('chat')
                .where('userId_1', '==', loggedUserId)
                .where('userId_2', '==', matchedProfileId);

            conversation1.get().then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    doc.ref.delete();
                });
            });

            const conversation2 = db.collection('chat')
                .where('userId_1', '==', matchedProfileId)
                .where('userId_2', '==', loggedUserId);

            conversation2.get().then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    doc.ref.delete();
                });
            });

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function deleteAccount() {
    return async (dispatch, getState) => {

        dispatch(showLoader(true));

        const dashboardState = getState().dashboard;
        const authState = getState().auth;

        try {

            await Api({ accessToken: authState.accessToken })
                .delete(`account/delete-account/${dashboardState.userData.id}`)
                .then(() => dispatch(signOut()));

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function signInLocalAction(userData) {
    return async dispatch => {
        try {

            dispatch(showLoader(true));

            const res = await Api({ accessToken: null }).post('account/signin', userData);

            dispatch(setAccessTokenOnStorageAndRedux(res.data.token));
            dispatch(updateUserDataOnRedux({ id: decodeJwtToken(res.data.token).id }));

            dispatch(showLoader(false));

            Keyboard.dismiss();

            dispatch({ type: Types.AUTH_SIGN_IN });

            dispatch(getUserData(true, true, true, true));

            RootNavigationRef.reset('Dashboard');

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function signInOauthAction(oauthAccessToken, type) {
    return async (dispatch, getState) => {

        const authState = getState().auth;

        try {

            dispatch(showLoader(true));

            let res;

            switch (type) {
                case 'facebook':
                    res = await Api({ accessToken: authState.accessToken }).post('account/facebook', { access_token: oauthAccessToken });
                    break;
                default:
                    res = await Api({ accessToken: authState.accessToken }).post('account/google', { access_token: oauthAccessToken });
                    break;
            }

            dispatch(setAccessTokenOnStorageAndRedux(res.data.token));

            dispatch(updateUserDataOnRedux({ id: decodeJwtToken(res.data.token).id }));

            dispatch(showLoader(false));

            Keyboard.dismiss();

            dispatch({ type: Types.AUTH_SIGN_IN });

            dispatch(getUserData(true, true, true, true));

            RootNavigationRef.reset('Dashboard');

        } catch (err) {
            dispatch(handleActionError(err));
        }
    }
}

export function handleActionError(err) {
    return dispatch => {

        dispatch(showLoader(false));

        //status 401 is Unauthorized, which means that user losed the access to the API
        if (err?.response?.status == 401 && err?.response?.data == 'Unauthorized')
            dispatch(signOut());
        else if (err?.message != 'Location permission not granted.')
            handleError(err);
    }
}

export function showContactModal(show) {
    return ({
        type: Types.OPEN_CONTACT_MODAL,
        isContactModalOpen: show
    })
}

export function showLoader(show) {
    return ({
        type: Types.SHOW_LOADER,
        showLoader: show
    })
}

export function setSelectedConfigMenu(selectedConfigMenu, selectedConfigMenuTitle) {
    return ({
        type: Types.SET_SELECTED_CONFIG_MENU,
        selectedConfigMenuTitle,
        selectedConfigMenu
    })
}
