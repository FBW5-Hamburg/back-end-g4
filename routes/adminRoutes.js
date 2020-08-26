const express = require('express')

//const dataModule = require('../modules/mongodbDataModule')
const dataModule = require('../modules/mongooseDataModule')
//const dataModule = require('../modules/mysqlDataModule')

const adminRouter = express.Router()

adminRouter.use((req, res, next) => {
    if (req.session.user) {
        next()
    } else {
        next()
        res.redirect('/login')
    }
})

adminRouter.get('/', (req, res) => {
    res.render('admin', {email: req.session.user.email})
    
});

adminRouter.get('/addPatient', (req, res) => {
    res.render('addPatient')
})

adminRouter.post('/addPatient', (req, res) => {
    //1 patient saved
    // 2 data error
    if (req.files) {
        const patientTitle = req.body.patientTitle
        const patientDescription = req.body.patientDescription
        const patientPdf = req.files.patientPdf
        if (patientTitle && patientDescription && patientPdf && Object.keys(req.files).length > 1) {
            const imgs = []
            for(const key in req.files) {
                if (req.files[key].mimetype != 'application/pdf') {
                    imgs.push(req.files[key])
                }
            } 
            dataModule.addPatient(patientTitle, patientDescription, patientPdf, imgs, req.session.user._id).then(() => {
                res.json(1)
            }).catch(error => {
                if (error == 3) {
                    res.json(3)
                }
            })
        } else {
            res.json(2)
        }
    } else {
        res.json(2)
    }
})

adminRouter.get('/myPatients', (req, res) => {
    dataModule.doctorPatients(req.session.user._id).then(patients => {
        res.render('myPatients', {patients})

    }).catch(error => {
        res.send('404. page can not be found')
    })
})

adminRouter.get('/logout',(req, res) => {
    req.session.destroy()
    res.redirect('/login')
})

//=== /myPatients/:id====//

adminRouter.get('/myPatients/:id', (req,res) => {
    const patientid = req.params.id
    dataModule.getPatient(patientid).then(patient => {
        res.render('editPatient', {patient})
    }).catch(error => {
        res.send('this patient is not exist')
    })
})


//=== adminRouter.post('/editPatient', (req, res) => { }) ===//
adminRouter.post('/editPatient', (req, res) => {
    const{ newPatientTitle, oldImgsUrls, patientDescriprion, patientid } = req.body

    let newPdfPatient = null
    let newImgs = []
    if (req.files) {
        newPdfPatient = req.files.patientPdf
        for (const key in req.files) {
            if (req.files[key].mimetype != 'application/pdf'){
                newImgs.push(req.files[key])
            }
        }
    }

    let oldImgsUrlsArr = JSON.parse(oldImgsUrls)

    oldImgsUrlsArr = oldImgsUrlsArr.map(element => {
        return element.substr(element.indexOf('/uploadedfiles/'))
    })

    dataModule.updatePatient(patientid, newPatientTitle, oldImgsUrlsArr, patientDescriprion, newPdfPatient, newImgs, req.session.user._id).then(() => {
        res.json(1)
    }).catch(error => {
        res.json(2)
    })
})


//=== adminRouter.post('/deletePatient', (req, res) => { }) ===//

adminRouter.post('/deletepatient', (req, res) => {
    const patientid = req.body.patientid
    dataModule.deletePatient(patientid, req.session.user._id).then(() => {
        res.json(1)
    }).catch(error => {
        res.json(2)
    })

}) 


module.exports = adminRouter