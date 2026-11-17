import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import Header from './src/components/Header.jsx';
import ApplicantSettings from './src/pages/ApplicantSettings.jsx';
import MentorAccountPanel from './src/components/MentorAccountPanel.jsx';
import AccountDeletionDialog from './src/components/AccountDeletionDialog.jsx';
import DeleteAccountSection from './src/components/DeleteAccountSection.jsx';
import './src/styles/global.css';
import './src/styles/board.css';
const profiles={applicant:{id:'fictional-applicant',name:'Avery Morgan',email:'avery@example.test',role:'applicant',notificationPreferences:{deadlineReminders:false,mentorFeedback:true}},mentor:{id:'fictional-mentor',name:'Riley Taylor',email:'riley@example.test',role:'mentor',notificationPreferences:{deadlineReminders:false,mentorFeedback:false}}};
const scope='Permanent deletion cannot be undone. The exact records removed and mentor-feedback retention have not been agreed. Live deletion remains unavailable.';
function Review(){
 const [view,setView]=useState('applicant'),[panel,setPanel]=useState(false),[dialog,setDialog]=useState(false),[portal,setPortal]=useState(null),[cleared,setCleared]=useState(false);
 const profile=profiles[view==='mentor'?'mentor':'applicant'];
 const api={request:async(path,options={})=>{if(path==='/settings'&&!options.method)return {_id:profile.id,...profile};throw Error('Mock review: all mutations and other requests are blocked.');}};
 useEffect(()=>{if(panel)setPortal(document.querySelector('.mentor-account-panel'));else setPortal(null);},[panel]);
 function closeDialog(){setCleared(document.getElementById('account-delete-password').value==='');setDialog(false);}
 const modal=dialog?<AccountDeletionDialog mockOnly target={profile} scope={scope} onCancel={closeDialog} onDelete={async()=>{throw Error('Review only. No deletion request was sent.');}}/>:null;
 return <><div className="review-banner"><strong>ISOLATED MOCK REVIEW</strong> — fictional accounts; no backend requests. Live deletion is unavailable.<div><button onClick={()=>{setView('applicant');setPanel(false);}}>Applicant Settings</button> <button onClick={()=>{setView('mentor');setPanel(true);}}>Mentor account panel</button> <button onClick={()=>{setView('admin');setPanel(false);}}>Admin availability</button> <span>Cancellation cleared password: {String(cleared)}</span></div></div>
 <Header variant={view==='admin'?'admin':profile.role} activePage={view==='applicant'?'settings':'students'} userInitial={profile.name[0]} onNavigate={()=>{}} accountControl={view==='mentor'?<button className="site-header__avatar" onClick={()=>setPanel(true)} aria-label="Open fictional mentor account">R</button>:undefined}/>
 {view==='applicant'&&<><ApplicantSettings api={api} accountId={profile.id} active onProfile={()=>{}} onLogout={()=>{}}/><div className="content-container review-launch"><button id="applicant-mock-delete" className="button button--secondary" onClick={()=>setDialog(true)}>Review mock applicant deletion dialog</button></div>{modal}</>}
 {view==='mentor'&&<main className="content-container"><h1>My Students</h1><p>Fictional Mentor account review. No student data loaded.</p></main>}
 {view==='admin'&&<main className="content-container"><h1>User Accounts</h1><p>Fictional review. No Admin deletion action or confirmation is implemented because eligibility and password authorization are not agreed.</p><DeleteAccountSection admin/></main>}
 {panel&&view==='mentor'&&<MentorAccountPanel api={api} user={profile} onProfile={()=>{}} onClose={()=>setPanel(false)} onLogout={()=>{}} warning="Isolated mock review. No backend requests or real account changes."/>}
 {panel&&portal&&createPortal(<div className="review-launch"><p>Mock review only — this launch control is absent from the real account panel.</p><button id="mentor-mock-delete" className="button button--secondary" onClick={()=>setDialog(true)}>Review mock mentor deletion dialog</button>{modal}</div>,portal)}
 <style>{`.review-banner{padding:.65rem 1.5rem;background:#fff5d6;border-bottom:1px solid #c49a27;font:14px 'Segoe UI',sans-serif;color:#3a2b00}.review-banner button{margin-top:.4rem;padding:.35rem .6rem;background:white;border:1px solid #93865c;border-radius:5px;cursor:pointer}.review-launch{margin-block:1rem}.review-launch p{font-size:.8rem;color:#5c4a1a}.review-launch .button{margin-bottom:.5rem}`}</style>
 </>;
}
createRoot(document.getElementById('root')).render(<Review/>);
